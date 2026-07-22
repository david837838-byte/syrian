(function (global) {
    'use strict';

    if (global.QRCode && typeof global.QRCode.toCanvas === 'function') {
        return;
    }

    var qrFactory = global.qrcode;
    if (typeof qrFactory !== 'function') {
        return;
    }

    function normalizeArgs(canvas, text, opts, cb) {
        if (typeof canvas === 'string') {
            cb = opts;
            opts = text;
            text = canvas;
            canvas = null;
        }

        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }

        return {
            canvas: canvas || document.createElement('canvas'),
            text: String(text || ''),
            opts: opts || {},
            cb: typeof cb === 'function' ? cb : null
        };
    }

    function drawQrToCanvas(targetCanvas, text, opts) {
        if (!text) {
            throw new Error('QR text is required');
        }

        var errorCorrectionLevel = String(opts.errorCorrectionLevel || 'M').toUpperCase();
        var qr = qrFactory(0, errorCorrectionLevel);
        qr.addData(text);
        qr.make();

        var moduleCount = qr.getModuleCount();
        var margin = Number.isFinite(Number(opts.margin)) ? Math.max(0, Number(opts.margin)) : 4;
        var requestedWidth = Number.isFinite(Number(opts.width)) ? Math.max(64, Number(opts.width)) : 256;
        var cellSize = Math.max(1, Math.floor((requestedWidth - (margin * 2)) / moduleCount));
        var size = (moduleCount * cellSize) + (margin * 2);

        targetCanvas.width = size;
        targetCanvas.height = size;

        var ctx = targetCanvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas context is unavailable');
        }

        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = opts.color && opts.color.light ? opts.color.light : '#ffffff';
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = opts.color && opts.color.dark ? opts.color.dark : '#000000';
        for (var row = 0; row < moduleCount; row += 1) {
            for (var col = 0; col < moduleCount; col += 1) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        margin + (col * cellSize),
                        margin + (row * cellSize),
                        cellSize,
                        cellSize
                    );
                }
            }
        }

        return targetCanvas;
    }

    global.QRCode = global.QRCode || {};
    global.QRCode.toCanvas = function toCanvas(canvas, text, opts, cb) {
        var args = normalizeArgs(canvas, text, opts, cb);

        if (!args.cb) {
            return new Promise(function (resolve, reject) {
                try {
                    resolve(drawQrToCanvas(args.canvas, args.text, args.opts));
                } catch (error) {
                    reject(error);
                }
            });
        }

        try {
            var renderedCanvas = drawQrToCanvas(args.canvas, args.text, args.opts);
            args.cb(null, renderedCanvas);
        } catch (error) {
            args.cb(error);
        }
    };
}(window));
