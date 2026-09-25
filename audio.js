// Web Audio API Sound Synthesizer for Snake Game
// Generates responsive, zero-latency 8-bit / arcade sound effects without any external audio files

class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('snake_muted') === 'true';
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                this.initialized = true;
            }
        } catch (e) {
            console.warn('Web Audio API not supported or blocked:', e);
        }
    }

    resumeContext() {
        if (!this.initialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('snake_muted', this.muted);
        if (!this.muted) {
            this.playClick();
        }
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    // Play a basic synthesized tone
    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15, freqEnd = null) {
        if (this.muted) return;
        this.resumeContext();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (freqEnd !== null) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), this.ctx.currentTime + duration);
            }

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio error safety
        }
    }

    // Normal Apple Eat Sound: cheerful crisp bleep
    playEat() {
        if (this.muted) return;
        this.resumeContext();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(740, now + 0.11);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    }

    // Golden Apple / Bonus Eat Sound: sparkling arpeggio
    playGoldenEat() {
        if (this.muted) return;
        this.resumeContext();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, index) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.12, 0.18, freq * 1.05);
            }, index * 45);
        });
    }

    // Special item (speed / freeze) sound
    playPowerUp() {
        if (this.muted) return;
        this.resumeContext();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(950, now + 0.22);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.22);
        } catch (e) {}
    }

    // Game Over Crash sound: deep crunch & slide down
    playGameOver() {
        if (this.muted) return;
        this.resumeContext();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            
            // Low thud
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(180, now);
            osc1.frequency.exponentialRampToValueAtTime(30, now + 0.45);

            gain1.gain.setValueAtTime(0.28, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);

            osc1.start(now);
            osc1.stop(now + 0.45);

            // High noise zap
            setTimeout(() => {
                this.playTone(90, 'square', 0.35, 0.15, 20);
            }, 80);
        } catch (e) {}
    }

    // UI Click sound
    playClick() {
        this.playTone(880, 'sine', 0.05, 0.08, 1200);
    }

    // Turn / Direction change sound (very subtle click)
    playTurn() {
        this.playTone(280, 'sine', 0.02, 0.03, 300);
    }

    // Pause sound
    playPause() {
        this.playTone(550, 'sine', 0.09, 0.1, 350);
    }

    // Resume sound
    playResume() {
        this.playTone(350, 'sine', 0.09, 0.1, 550);
    }

    // High Score Fanfare
    playNewHighScore() {
        if (this.muted) return;
        const melody = [440, 554, 659, 880, 1108];
        melody.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'triangle', 0.16, 0.2);
            }, idx * 70);
        });
    }
}

// Global instance
window.soundManager = new SoundManager();
