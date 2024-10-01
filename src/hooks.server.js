import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicDir = path.join(__dirname, '..', 'music');
let playlist = [];
let currentSongIndex = 0;
let ffmpegProcess;

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
    const currentSong = path.basename(playlist[currentSongIndex], path.extname(playlist[currentSongIndex]));
    const nextSong = path.basename(playlist[(currentSongIndex + 1) % playlist.length], path.extname(playlist[(currentSongIndex + 1) % playlist.length]));

    const currentSongParts = currentSong.split(' - ');
    const nextSongParts = nextSong.split(' - ');

    const state = {
        currentSongTitle: currentSongParts[1] || 'Unknown Title',
        currentArtist: currentSongParts[0] || 'Unknown Artist',
        nextSongTitle: nextSongParts[1] || 'Unknown Title',
        nextArtist: nextSongParts[0] || 'Unknown Artist'
    };

    const staticDir = path.join(__dirname, '..', 'static');
    if (!fs.existsSync(staticDir)) {
        fs.mkdirSync(staticDir, { recursive: true });
    }
    fs.writeFileSync(path.join(staticDir, 'radio_state.json'), JSON.stringify(state));
    
    console.log(`Now playing: ${currentSong}`);

    try {
        const duration = await getDuration(playlist[currentSongIndex]);
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        setTimeout(updateNowPlaying, duration * 1000);
    } catch (error) {
        console.error('Error getting song duration:', error);
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        setTimeout(updateNowPlaying, 5000);
    }
}

function startStreaming() {
    const playlistFile = path.join(__dirname, '..', 'playlist.txt');
    
    // Escape single quotes in file paths
    const escapedPlaylist = playlist.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
    
    fs.writeFileSync(playlistFile, escapedPlaylist);

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
        '-hls_segment_filename', path.join(__dirname, '..', 'static', 'stream', 'segment_%03d.ts'),
        path.join(__dirname, '..', 'static', 'stream', 'playlist.m3u8')
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


export async function handle({ event, resolve }) {
    if (!ffmpegProcess) {
        loadPlaylist();
        if (!fs.existsSync(path.join(__dirname, '..', 'static', 'stream'))) {
            fs.mkdirSync(path.join(__dirname, '..', 'static', 'stream'), { recursive: true });
        }
        startStreaming();
        updateNowPlaying();
    }

    const response = await resolve(event);
    return response;
}

process.on('SIGINT', () => {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT');
    }
    process.exit();
});