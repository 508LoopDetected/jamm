<script>
  import { onMount } from 'svelte';
  import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-svelte';

  let currentTrack = { title: 'N/A', artist: 'N/A' };
  let nextTrack = { title: 'N/A', artist: 'N/A' };
  let isPlaying = false;
  let volume = 1;
  let audioPlayer;
  let hls;
  let errorMessage = '';

  function handleAudioError(e) {
    console.error('Audio player error:', e);
    errorMessage = `Audio player error: ${e.target.error.message}`;
  }

  function initializeStream() {
    if (Hls.isSupported()) {
      console.log('Initializing HLS stream');
      hls = new Hls();
      hls.loadSource('/stream/playlist.m3u8');
      hls.on(Hls.Events.ERROR, function (event, data) {
        console.error('HLS error:', data);
        errorMessage = `HLS error: ${data.type} - ${data.details}`;
      });
      audioPlayer = new Audio();
      hls.attachMedia(audioPlayer);
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        audioPlayer.play().catch(e => {
          console.error('Error playing audio:', e);
          errorMessage = `Error playing audio: ${e.message}`;
        });
      });
    } else if (audioPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('Initializing native HLS stream');
      audioPlayer = new Audio('/stream/playlist.m3u8');
      audioPlayer.play().catch(e => {
        console.error('Error playing audio:', e);
        errorMessage = `Error playing audio: ${e.message}`;
      });
    } else {
      console.error('HLS is not supported in this browser');
      errorMessage = 'HLS playback is not supported in this browser.';
      return;
    }

    if (audioPlayer) {
      audioPlayer.addEventListener('error', handleAudioError);

      audioPlayer.addEventListener('playing', () => {
        console.log('Audio started playing');
        isPlaying = true;
      });

      audioPlayer.addEventListener('pause', () => {
        console.log('Audio paused');
        isPlaying = false;
      });
    }
  }

  function destroyStream() {
    console.log('Destroying stream');
    if (audioPlayer) {
      audioPlayer.removeEventListener('error', handleAudioError);
      audioPlayer.pause();
      audioPlayer.src = '';
      audioPlayer.load();
    }
    if (hls) {
      hls.destroy();
      hls = null;
    }
    audioPlayer = null;
    isPlaying = false;
    errorMessage = ''; // Clear any existing error messages
  }

  onMount(() => {
    const updateInfo = async () => {
      try {
        const response = await fetch('/get_info');
        const data = await response.json();
        currentTrack = {
          title: data.currentSongTitle,
          artist: data.currentArtist
        };
        nextTrack = {
          title: data.nextSongTitle,
          artist: data.nextArtist
        };
      } catch (error) {
        console.error('Error fetching track info:', error);
        errorMessage = `Error fetching track info: ${error.message}`;
      }
    };

    updateInfo();
    const interval = setInterval(updateInfo, 2000);

    return () => {
      clearInterval(interval);
      destroyStream();
    };
  });

  function togglePlay() {
    if (isPlaying) {
      destroyStream();
    } else {
      initializeStream();
    }
  }

  function updateVolume() {
    if (audioPlayer) {
      audioPlayer.volume = volume;
    }
  }

  $: if (audioPlayer) {
    audioPlayer.volume = volume;
  }
</script>

<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</svelte:head>

<div class="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
  <img src="/img/jamm.svg" alt="JAMM Logo" class="w-24 mb-12" />
  
  <div class="w-full max-w-md bg-gray-900 rounded-lg shadow-lg overflow-hidden">
    <div class="p-8">
      <h1 class="text-3xl font-bold text-center mb-6 text-red-500">Now Playing</h1>
      
      <div class="text-center mb-8">
        <h2 class="text-2xl font-semibold mb-2">{currentTrack.title}</h2>
        <p class="text-gray-400">{currentTrack.artist}</p>
      </div>
      
      <div class="flex justify-center items-center space-x-6 mb-8">
        <button class="text-gray-400 hover:text-red-500 transition-colors">
          <SkipBack size={24} />
        </button>
        <button 
          class="bg-red-500 text-white rounded-full p-4 hover:bg-red-600 transition-colors"
          on:click={togglePlay}
        >
          {#if isPlaying}
            <Pause size={32} />
          {:else}
            <Play size={32} />
          {/if}
        </button>
        <button class="text-gray-400 hover:text-red-500 transition-colors">
          <SkipForward size={24} />
        </button>
      </div>
      
      <div class="flex items-center space-x-2">
        <Volume2 size={20} class="text-gray-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={volume}
          on:input={updateVolume}
          class="w-full accent-red-500"
        />
      </div>
    </div>
    
    <div class="bg-gray-800 p-4">
      <h3 class="text-sm font-semibold text-gray-400 mb-2">Up Next</h3>
      <p class="text-sm">{nextTrack.title} - {nextTrack.artist}</p>
    </div>
  </div>

  {#if errorMessage}
    <div class="mt-4 p-4 bg-red-500 text-white rounded">
      {errorMessage}
    </div>
  {/if}
</div>