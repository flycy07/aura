const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Percorso in cui il server salverà l'eseguibile di yt-dlp
const ytDlpFileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(__dirname, ytDlpFileName);

async function initYtDlp() {
    if (!fs.existsSync(ytDlpPath)) {
        console.log('Scaricamento automatico di yt-dlp in corso...');
        await YTDlpWrap.downloadFromGithub(ytDlpPath);
        console.log('yt-dlp pronto!');
    }
}

const ytDlpWrap = new YTDlpWrap(ytDlpPath);

app.get('/api/stream', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Manca la query' });

    try {
        await initYtDlp();
        const output = await ytDlpWrap.exec([
            `ytsearch1:${query}`,
            '-g',
            '-f',
            'bestaudio'
        ]);

        const audioUrl = output.trim().split('\n')[0];
        if (!audioUrl) return res.status(500).json({ error: 'Audio non trovato' });

        res.json({ success: true, audioUrl });
    } catch (error) {
        console.error('Errore yt-dlp:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

app.listen(PORT, () => {
    console.log(`Server attivo sulla porta ${PORT}`);
});
