<script>
  import { onMount } from 'svelte';
  import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-svelte';

  let currentTrack = { title: 'N/A', artist: 'N/A' };
  let nextTrack = { title: 'N/A', artist: 'N/A' };
  let isPlaying = false;
  let volume = 1;
  let audioPlayer;

  onMount(() => {
    audioPlayer = new Audio('/stream/playlist.m3u8');
    
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
      }
    };

    updateInfo();
    const interval = setInterval(updateInfo, 2000);

    return () => clearInterval(interval);
  });

  function togglePlay() {
    if (isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play();
    }
    isPlaying = !isPlaying;
  }

  function updateVolume() {
    audioPlayer.volume = volume;
  }
</script>

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
</div>