<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';

  export let audioPlayer;
  export let visualizerType = 'off';

  let canvas;
  let ctx;
  let audioContext;
  let analyser;
  let dataArray;
  let animationId;
  const BAR_COUNT = 64;
  let barHeights = new Array(BAR_COUNT).fill(0);

  $: if (audioPlayer) {
    setupAudioContext();
  }

  $: if (audioContext && visualizerType !== 'off') {
    startVisualizer();
  } else if (visualizerType === 'off') {
    stopVisualizer();
  }

  function setupAudioContext() {
    if (audioContext) {
      audioContext.close();
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audioPlayer);
    analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
  }

  function startVisualizer() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    renderVisualizer();
  }

  function stopVisualizer() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function renderVisualizer() {
    if (visualizerType === 'off') {
      stopVisualizer();
      return;
    }

    animationId = requestAnimationFrame(renderVisualizer);
    analyser.getByteFrequencyData(dataArray);

    switch (visualizerType) {
      case 'bar':
        renderBarVisualizer();
        break;
      case 'granular':
        renderGranularVisualizer();
        break;
      case 'kaleidoscope':
        renderKaleidoscopeVisualizer();
        break;
      case 'waves':
        renderWavesVisualizer();
        break;
    }
  }

  function renderBarVisualizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const barSpacing = 4;
    const numBars = 32;
    const barWidth = (canvas.width / numBars) - barSpacing;
    const maxBarHeight = canvas.height * 0.45;
    const minBarHeight = canvas.height / 200;

    // Limit the frequency range (focus on lower to mid frequencies)
    const maxFrequency = dataArray.length / 2; // Use only the first half of frequency data

    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';

    for (let i = 0; i < numBars / 2; i++) {
      const dataIndex = Math.floor((i / (numBars / 2)) * maxFrequency);
      const audioValue = dataArray[dataIndex] / 255.0;
      
      const scaledAudioValue = Math.pow(audioValue, 2);
      const targetHeight = minBarHeight + scaledAudioValue * (maxBarHeight - minBarHeight);
      
      barHeights[i] = barHeights[i] + (targetHeight - barHeights[i]) * 0.6;

      const barHeight = barHeights[i];

      // Draw bar in top-right quadrant
      ctx.fillRect(centerX + i * (barWidth + barSpacing), centerY - barHeight, barWidth, barHeight);
      // Draw bar in top-left quadrant (mirrored)
      ctx.fillRect(centerX - (i + 1) * (barWidth + barSpacing), centerY - barHeight, barWidth, barHeight);
      // Draw bar in bottom-right quadrant
      ctx.fillRect(centerX + i * (barWidth + barSpacing), centerY, barWidth, barHeight);
      // Draw bar in bottom-left quadrant (mirrored)
      ctx.fillRect(centerX - (i + 1) * (barWidth + barSpacing), centerY, barWidth, barHeight);
    }
  }

  function renderGranularVisualizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = 5;
    const maxDistance = Math.min(canvas.width, canvas.height) * 0.55;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';

    for (let i = 0; i < dataArray.length; i++) {
      const amplitude = dataArray[i] / 255;
      const angle = (i / dataArray.length) * Math.PI * 2; // Full circle
      const distance = amplitude * maxDistance;
      const radius = amplitude * maxRadius;

      const drawParticle = (x, y) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      };

      // Draw particle in all four quadrants
      drawParticle(centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance);
      drawParticle(centerX - Math.cos(angle) * distance, centerY + Math.sin(angle) * distance);
      drawParticle(centerX + Math.cos(angle) * distance, centerY - Math.sin(angle) * distance);
      drawParticle(centerX - Math.cos(angle) * distance, centerY - Math.sin(angle) * distance);
    }
  }

  function renderKaleidoscopeVisualizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.max(canvas.width, canvas.height) * 0.55;

    ctx.save();
    ctx.translate(centerX, centerY);

    const segments = 12;
    const angleStep = (Math.PI * 2) / segments;

    for (let s = 0; s < segments; s++) {
      ctx.save();
      ctx.rotate(s * angleStep);

      for (let i = 0; i < dataArray.length; i += 4) {
        const amplitude = dataArray[i] / 255;
        const radius = amplitude * maxRadius;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, 0, angleStep);
        ctx.closePath();

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.0)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Add some animated lines
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          radius * Math.cos(angleStep / 2 + performance.now() / 1000),
          radius * Math.sin(angleStep / 2 + performance.now() / 1000)
        );
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.005)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function renderWavesVisualizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = canvas.width / BAR_COUNT;
    const maxBarHeight = canvas.height * 0.8;

    // Limit the frequency range (focus on lower to mid frequencies)
    const maxFrequency = dataArray.length / 4; // Use only the first quarter of the frequency data

    for (let i = 0; i < BAR_COUNT; i++) {
      const audioIndex = Math.floor((i / BAR_COUNT) * maxFrequency);
      const audioValue = dataArray[audioIndex] / 255.0;
      const targetHeight = audioValue * maxBarHeight;
      
      barHeights[i] = barHeights[i] + (targetHeight - barHeights[i]) * 0.3;
    }

    // Draw bars
    for (let i = 0; i < BAR_COUNT; i++) {
      const x = i * barWidth;
      const height = barHeights[i];

      // Create gradient
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - height);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.14)');  // More opaque at the bottom
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');  // More transparent at the top

      ctx.fillStyle = gradient;

      // Draw rounded top for each bar
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x, canvas.height - height + barWidth / 2);
      ctx.quadraticCurveTo(x + barWidth / 2, canvas.height - height, x + barWidth, canvas.height - height + barWidth / 2);
      ctx.lineTo(x + barWidth, canvas.height);
      ctx.fill();

      // Draw circle at the top of each bar
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, canvas.height - height, barWidth / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
      ctx.fill();
    }

    // Draw connecting lines
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - barHeights[0]);
    for (let i = 1; i < BAR_COUNT; i++) {
      const x = i * barWidth;
      ctx.lineTo(x, canvas.height - barHeights[i]);
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
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

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  });

  afterUpdate(() => {
    if (audioPlayer && audioContext) {
      startVisualizer();
    }
  });

  onDestroy(() => {
    stopVisualizer();
    if (audioContext) {
      audioContext.close();
    }
  });
</script>

<canvas id="visualizer" class="absolute inset-0 w-full h-full"></canvas>