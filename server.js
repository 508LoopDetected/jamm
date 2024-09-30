const fs = require('fs');
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const app = express();
const port = 3000;

const musicDir = './music';
let playlist = [];
let currentSongIndex = 0;
let ffmpegProcess;
const streamEvents = new EventEmitter();

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function loadPlaylist() {
    playlist = fs.readdirSync(musicDir)
        .filter(file => ['.mp3', '.flac'].includes(path.extname(file).toLowerCase()))
        .map(file => path.join(musicDir, file));
    shuffleArray(playlist);
}

function getDuration(file) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            file
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                resolve(parseFloat(output));
            } else {
                reject(new Error(`ffprobe process exited with code ${code}`));
            }
        });
    });
}

async function updateNowPlaying() {
    const currentSong = path.basename(playlist[currentSongIndex]);
    const nextSong = path.basename(playlist[(currentSongIndex + 1) % playlist.length]);
    
    const state = {
        currentSong: currentSong,
        nextSong: nextSong
    };
    fs.writeFileSync('./public/radio_state.json', JSON.stringify(state));
    
    console.log(`Now playing: ${currentSong}`);
    
    try {
        const duration = await getDuration(playlist[currentSongIndex]);
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        setTimeout(updateNowPlaying, duration * 1000);
    } catch (error) {
        console.error('Error getting song duration:', error);
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        setTimeout(updateNowPlaying, 5000); // Default to 5 seconds if there's an error
    }
}

loadPlaylist();

function startStreaming() {
    const playlistFile = path.join(__dirname, 'playlist.txt');
    fs.writeFileSync(playlistFile, playlist.map(file => `file '${file}'`).join('\n'));

    console.log('Starting FFmpeg process...');
    ffmpegProcess = spawn('ffmpeg', [
        '-re',
        '-f', 'concat',
        '-safe', '0',
        '-i', playlistFile,
        '-vn',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '10',
        '-hls_flags', 'delete_segments',
        '-hls_segment_filename', './public/stream/segment_%03d.ts',
        './public/stream/playlist.m3u8'
    ]);

    ffmpegProcess.stderr.on('data', (data) => {
        console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        console.log('Restarting streaming...');
        startStreaming();
    });
}

app.use(express.static('public'));

app.get('/get_info', (req, res) => {
    const state = JSON.parse(fs.readFileSync('./public/radio_state.json', 'utf8'));
    res.json(state);
});

app.get('/stream/playlist.m3u8', (req, res) => {
    console.log('Playlist requested');
    res.sendFile(path.join(__dirname, 'public', 'stream', 'playlist.m3u8'));
});

app.listen(port, () => {
    console.log(`Web server running at http://localhost:${port}`);
    // Ensure the stream directory exists
    if (!fs.existsSync('./public/stream')) {
        fs.mkdirSync('./public/stream', { recursive: true });
    }
    // Start streaming
    startStreaming();
    // Start updating now playing info
    updateNowPlaying();
});

process.on('SIGINT', () => {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT');
    }
    process.exit();
});