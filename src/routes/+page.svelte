<script>
  import { onMount } from 'svelte';
  import { Play, Pause, SkipBack, Settings, Volume2 } from 'lucide-svelte';

  let currentTrack = { title: 'N/A', artist: 'N/A' };
  let nextTrack = { title: 'N/A', artist: 'N/A' };
  let isPlaying = false;
  let volume = 1;
  let audioPlayer;
  let hls;
  let errorMessage = '';
  let canvas;
  let ctx;
  let analyser;
  let dataArray;
  let animationId;
  let visualizerType = 'bar';
  let showSettings = false;

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
        audioPlayer.play().then(() => {
          setupVisualizer();
        }).catch(e => {
          console.error('Error playing audio:', e);
          errorMessage = `Error playing audio: ${e.message}`;
        });
      });
    } else if (audioPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('Initializing native HLS stream');
      audioPlayer = new Audio('/stream/playlist.m3u8');
      audioPlayer.play().then(() => {
        setupVisualizer();
      }).catch(e => {
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
    errorMessage = '';
    
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function setupVisualizer() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audioPlayer);
    analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    renderVisualizer();
  }


  function renderBarVisualizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const barSpacing = 2;
    const barWidth = (canvas.width / dataArray.length) - barSpacing;
    const maxBarHeight = canvas.height * 0.4;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';

    for (let i = 0; i < dataArray.length / 2; i++) {
      const barHeight = (dataArray[i] / 255) * maxBarHeight;

      ctx.fillRect(centerX + i * (barWidth + barSpacing), centerY - barHeight, barWidth, barHeight);
      ctx.fillRect(centerX - (i + 1) * (barWidth + barSpacing), centerY - barHeight, barWidth, barHeight);
      ctx.fillRect(centerX + i * (barWidth + barSpacing), centerY, barWidth, barHeight);
      ctx.fillRect(centerX - (i + 1) * (barWidth + barSpacing), centerY, barWidth, barHeight);
    }
  }

  function renderGranularVisualizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = 3;
    const maxDistance = Math.min(canvas.width, canvas.height) * 0.4;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';

    for (let i = 0; i < dataArray.length / 2; i++) {
      const amplitude = dataArray[i] / 255;
      const angle = (i / (dataArray.length / 2)) * Math.PI;
      const distance = amplitude * maxDistance;
      const radius = amplitude * maxRadius;

      const drawParticle = (x, y) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      };

      const positions = [
        [centerX + Math.cos(angle) * distance, centerY - Math.sin(angle) * distance],
        [centerX - Math.cos(angle) * distance, centerY - Math.sin(angle) * distance],
        [centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance],
        [centerX - Math.cos(angle) * distance, centerY + Math.sin(angle) * distance]
      ];

      positions.forEach(([x, y]) => drawParticle(x, y));
    }
  }

  function renderVisualizer() {
    animationId = requestAnimationFrame(renderVisualizer);
    analyser.getByteFrequencyData(dataArray);

    if (visualizerType === 'bar') {
      renderBarVisualizer();
    } else {
      renderGranularVisualizer();
    }
  }

  function toggleSettings() {
    showSettings = !showSettings;
  }

  function setVisualizerType(type) {
    visualizerType = type;
    showSettings = false;
  }

  onMount(() => {
    canvas = document.getElementById('visualizer');
    ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      const player = document.getElementById('player');
      canvas.width = player.offsetWidth;
      canvas.height = player.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

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
      window.removeEventListener('resize', resizeCanvas);
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
  
  <div class="w-full max-w-md bg-gray-900 rounded-lg shadow-lg overflow-hidden">
    <div id="player" class="p-6 px-8 relative">
      <canvas id="visualizer" class="absolute inset-0 w-full h-full"></canvas>
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
        <div class="flex justify-center space-x-4">
          <button
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('bar')}
          >
            Bar
          </button>
          <button
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            on:click={() => setVisualizerType('granular')}
          >
            Granular
          </button>
        </div>
      {:else}
        <h3 class="text-sm font-semibold text-red-500 uppercase">Up Next</h3>
        <p class="text-sm text-gray-400">{nextTrack.title} - {nextTrack.artist}</p>
      {/if}
    </div>
  </div>

  {#if errorMessage}
    <div class="mt-4 p-4 bg-red-500 text-white rounded">
      {errorMessage}
    </div>
  {/if}
</div>