import { writable } from 'svelte/store';

export const currentTrack = writable({ title: 'N/A', artist: 'N/A' });
export const nextTrack = writable({ title: 'N/A', artist: 'N/A' });