class PCMPlayer extends AudioWorkletProcessor {
    constructor() {
        super();

        this.streams = new Map();
		this.endedStreams = new Set();
        this.lastLogTime = 0;
		this.debug = false;

        this.port.onmessage = (e) => {
			const { id, samples } = e.data;
			let stream = this.streams.get(id);
			
			if (e.data.type === "debug") {
				this.debug = e.data.value;
				return;
			}
			
			if (e.data.type === "end") {
				this.endedStreams.add(id);
				if (stream)
					stream.started = true; // in case it was a short burst of audio
				return;
			}
			
			this.endedStreams.delete(id);

            if (!stream) {
                stream = {
                    queue: [],
                    current: null,
                    offset: 0,

                    bufferedSamples: 0,
                    started: false
                };

                this.streams.set(id, stream);
            }

            stream.queue.push(samples);
            stream.bufferedSamples += samples.length;
			
			const maxBufferedSamples = sampleRate * 2.0;
			const idealMaxBufferedSamples = sampleRate * 1.0;
			
			if (id != 0 && stream.bufferedSamples > maxBufferedSamples) {
				let oldSz = Math.floor((stream.bufferedSamples / sampleRate)*1000);
				
				// skip ahead if too much is buffered, unless it's the chat sound steamid
				// which sends the full buffer in advance
				while (stream.bufferedSamples > idealMaxBufferedSamples) {
					if (stream.queue.length === 0)
						break;

					const chunk = stream.queue.shift();

					stream.bufferedSamples -= chunk.length;
				}
				
				if (this.debug) {
					console.log("Skip ahead ", id, oldSz, " ms -> ", Math.floor((stream.bufferedSamples / sampleRate)*1000), " ms");
				}
			}
        };
    }

    process(inputs, outputs) {
        const output = outputs[0][0];

        // Start each stream only after it has 200ms buffered.
        for (const [id, stream] of this.streams.entries()) {
            if (stream.bufferedSamples === 0) {
                stream.started = false;
				this.endedStreams.has(id);
				this.streams.delete(id);
			}

            if (!stream.started && stream.bufferedSamples >= sampleRate * 0.50) {
                stream.started = true;
				this.playedSamples = 0;
				this.playStartTime = currentTime;
            }
        }

        // Start with silence, then mix each stream into it.
        output.fill(0);

        for (const stream of this.streams.values()) {
            if (!stream.started)
                continue;

            let pos = 0;

            while (pos < output.length) {
                if (!stream.current) {
                    if (stream.queue.length === 0)
                        break;

                    stream.current = stream.queue.shift();
                    stream.offset = 0;
                }

                const count = Math.min(
                    output.length - pos,
                    stream.current.length - stream.offset
                );

                for (let i = 0; i < count; i++) {
                    output[pos + i] +=
                        stream.current[stream.offset + i];
                }

                stream.offset += count;
                pos += count;
                stream.bufferedSamples -= count;

                if (stream.offset >= stream.current.length)
                    stream.current = null;
            }
        }

        // Log buffer levels roughly every 100ms.
		if (this.debug) {
			this.playedSamples += output.length;

			if (currentTime - this.playStartTime >= 1) {
				this.playbackRate = this.playedSamples / (currentTime - this.playStartTime);
				this.playedSamples = 0;
				this.playStartTime = currentTime;
			}
			
			const now = currentTime * 1000;
			if (now - this.lastLogTime >= 100) {
				for (const [id, stream] of this.streams) {
					this.port.postMessage({
						type: "debug",
						bufferMs: Math.floor(stream.bufferedSamples / sampleRate * 1000),
						rate: this.playbackRate
					});
				}

				this.lastLogTime = now;
			}
		}

        return true;
    }
}

registerProcessor("pcm-player", PCMPlayer);