class PCMPlayer extends AudioWorkletProcessor {
    constructor() {
        super();

        this.queue = [];
        this.current = null;
        this.offset = 0;

        this.port.onmessage = (e) => {
            this.queue.push(e.data);
        };
    }

    process(inputs, outputs) {		
        const output = outputs[0][0];

        let pos = 0;

        while (pos < output.length) {
            if (!this.current) {
                if (this.queue.length === 0)
                    break;

                this.current = this.queue.shift();
                this.offset = 0;
            }

            const count = Math.min(
                output.length - pos,
                this.current.length - this.offset
            );

            output.set(
                this.current.subarray(
                    this.offset,
                    this.offset + count
                ),
                pos
            );

            this.offset += count;
            pos += count;

            if (this.offset >= this.current.length)
                this.current = null;
        }

        // Silence if we don't have enough samples.
        output.fill(0, pos);

        return true;
    }
}

registerProcessor("pcm-player", PCMPlayer);