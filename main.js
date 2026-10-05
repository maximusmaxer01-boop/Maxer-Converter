const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const FFMPEG_PATH = 'C:\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';
const FFPROBE_PATH = 'C:\\ffmpeg-8.1.2-essentials_build\\bin\\ffprobe.exe';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 680,
    height: 620,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Maxer Converter',
    autoHideMenuBar: true
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('localvideo', (request, callback) => {
    const url = request.url.replace('localvideo://', '');
    const filePath = decodeURIComponent(url);
    callback({ path: filePath });
  });
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4','mkv','avi','mov','wmv','flv','webm','m4v','3gp'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-duration', async (_, filePath) => {
  return new Promise((resolve) => {
    const proc = spawn(FFPROBE_PATH, ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath]);
    let data = '';
    proc.stdout.on('data', d => data += d);
    proc.on('close', () => {
      try {
        const info = JSON.parse(data);
        const stream = info.streams.find(s => s.duration) || info.streams[0];
        resolve(parseFloat(stream.duration) || 0);
      } catch { resolve(0); }
    });
  });
});

ipcMain.handle('convert', async (_, config) => {
  return new Promise((resolve) => {
    const { inputPath, outputPath, format, startTime, endTime, volume } = config;
    const args = ['-i', inputPath, '-y'];
    if (startTime > 0) args.push('-ss', startTime.toString());
    if (endTime > 0) args.push('-to', endTime.toString());
    if (volume !== 1) args.push('-filter:a', `volume=${volume}`);
    if (format === 'mp3') args.push('-q:a', '0', '-map', 'a');
    else if (format === 'wav') args.push('-map', 'a');
    else if (format === 'ogg') args.push('-map', 'a', '-c:a', 'libvorbis');
    else if (format === 'aac') args.push('-map', 'a', '-c:a', 'aac');
    else if (format === 'flac') args.push('-map', 'a', '-c:a', 'flac');
    args.push(outputPath);
    const proc = spawn(FFMPEG_PATH, args);
    let errData = '';
    proc.stderr.on('data', d => {
      errData += d.toString();
      const timeMatch = errData.match(/time=(\d+):(\d+):(\d+\.\d+)/g);
      if (timeMatch) {
        const last = timeMatch[timeMatch.length-1];
        const m = last.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (m) {
          const secs = parseInt(m[1])*3600 + parseInt(m[2])*60 + parseFloat(m[3]);
          win.webContents.send('progress', secs);
        }
      }
    });
    proc.on('close', (code) => resolve({ success: code === 0, error: errData }));
  });
});