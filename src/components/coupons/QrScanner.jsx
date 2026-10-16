import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const CAMERA_ERRORS = {
    NotAllowedError: 'Permissão da câmera negada. Libere o acesso no navegador ou digite o código abaixo.',
    NotFoundError: 'Nenhuma câmera encontrada neste aparelho. Digite o código abaixo.',
    NotReadableError: 'A câmera está em uso por outro aplicativo. Feche-o ou digite o código abaixo.',
    unsupported: 'Este navegador não permite usar a câmera aqui. Digite o código abaixo.',
};

/**
 * Leitor de QR pela câmera traseira. A permissão só é pedida no clique, e o
 * decodificador (jsQR) só é baixado nesse momento. Qualquer falha cai na
 * entrada manual, que continua sempre disponível.
 */
export default function QrScanner({ onDecode, disabled }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const frameRef = useRef(0);
    const [state, setState] = useState('idle');
    const [error, setError] = useState('');

    const stop = () => {
        cancelAnimationFrame(frameRef.current);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setState('idle');
    };

    useEffect(() => () => {
        cancelAnimationFrame(frameRef.current);
        streamRef.current?.getTracks().forEach((track) => track.stop());
    }, []);

    const start = async () => {
        setError('');
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(CAMERA_ERRORS.unsupported);
            return;
        }
        setState('starting');
        try {
            const [{ default: jsQR }, stream] = await Promise.all([
                import('jsqr'),
                navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
            ]);
            streamRef.current = stream;
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();
            setState('scanning');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            const tick = () => {
                if (!streamRef.current) return;
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const image = context.getImageData(0, 0, canvas.width, canvas.height);
                    const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
                    if (result?.data) {
                        stop();
                        onDecode(result.data);
                        return;
                    }
                }
                frameRef.current = requestAnimationFrame(tick);
            };
            frameRef.current = requestAnimationFrame(tick);
        } catch (failure) {
            stop();
            setError(CAMERA_ERRORS[failure?.name] ?? CAMERA_ERRORS.unsupported);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className={state === 'scanning' ? 'block' : 'hidden'}>
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    aria-label="Imagem da câmera para ler o QR Code do cupom"
                    className="aspect-square w-full max-w-xs rounded-2xl bg-dark-ocean object-cover"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {state === 'scanning' ? (
                    <button
                        type="button"
                        onClick={stop}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-dark-ocean shadow-sm"
                    >
                        <CameraOff size={16} aria-hidden="true" />
                        Parar câmera
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={start}
                        disabled={disabled || state === 'starting'}
                        aria-busy={state === 'starting'}
                        className="inline-flex items-center gap-2 rounded-full bg-turquoise px-5 py-2.5 text-sm font-bold text-sand disabled:opacity-60"
                    >
                        {state === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
                        Ler QR com a câmera
                    </button>
                )}
            </div>
            {error && (
                <p role="alert" className="rounded-2xl bg-sun/10 px-4 py-3 text-sm text-dark-ocean">
                    {error}
                </p>
            )}
        </div>
    );
}
