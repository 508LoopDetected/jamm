<script>
  import { onMount } from 'svelte';
  import { Play, Pause, SkipBack, Settings, Volume2 } from 'lucide-svelte';
  import Visualizer from '$lib/components/Visualizer.svelte';

  let currentTrack = { title: 'N/A', artist: 'N/A' };
  let nextTrack = { title: 'N/A', artist: 'N/A' };
  let isPlaying = false;
  let volume = 1;
  let audioPlayer;
  let hls;
  let errorMessage = '';
  let visualizerType = 'off';
  let showSettings = false;
  let visualizerKey = 0;

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
        visualizerKey++; // Add this line
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
    errorMessage = '';
    visualizerKey++;
  }

  function setVisualizerType(type) {
    visualizerType = type;
    showSettings = false;
  }

  function toggleSettings() {
    showSettings = !showSettings;
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
  <img src="/img/jamm.svg" alt="JAMM Logo" class="w-48 mb-4" />
  <h1 class="text-2xl font-bold text-center mb-8 text-red-500">1990s MEGAMIX</h1>
  
  <div class="w-full max-w-md bg-gray-900 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
    <div id="player" class="p-6 px-8 relative">
      <Visualizer {audioPlayer} {visualizerType} key={visualizerKey} />
      <div class="relative z-10">
        <div class="text-center mb-8">
          <h2 class="text-2xl font-semibold mb-2 text-white">{currentTrack.title}</h2>
          <p class="text-gray-300">{currentTrack.artist}</p>
        </div>
        
        <div class="flex justify-center items-center space-x-6 mb-8">
          <button class="text-gray-300 hover:text-red-500 transition-colors">
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
          <button class="text-gray-300 hover:text-red-500 transition-colors" on:click={toggleSettings}>
            <Settings size={24} />
          </button>
        </div>
        
        <div class="flex items-center space-x-2">
          <Volume2 size={20} class="text-gray-300" />
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
    </div>
    

    <div class="bg-gray-800 p-4 text-center">
      {#if showSettings}
        <div class="flex flex-wrap justify-center gap-2">
          <button
            class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('bar')}
          >
            Bar
          </button>
          <button
            class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('granular')}
          >
            Granular
          </button>
          <button
            class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('kaleidoscope')}
          >
            Kaleidoscope
          </button>
          <button
            class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('waves')}
          >
            Waves
          </button>
          <button
            class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('off')}
          >
            Off
          </button>
        </div>
      {:else}
        <h3 class="text-sm font-semibold text-red-500 uppercase">Up Next</h3>
        <p class="text-sm text-gray-400">{nextTrack.artist} - {nextTrack.title}</p>
      {/if}
    </div>
  </div>

  {#if errorMessage}
    <div class="mt-4 p-4 bg-red-500 text-white rounded">
      {errorMessage}
    </div>
  {/if}
</div>