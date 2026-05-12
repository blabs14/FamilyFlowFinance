import { useState, useRef, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Slider } from '../../components/ui/slider';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, Loader2 } from 'lucide-react';

interface AvatarUploaderProps {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}

const MAX_SIZE_MB = 2;
const BUCKET = 'avatars';
const OUTPUT_SIZE = 256;

/** Crops the image to the given pixel area using an offscreen canvas, returns a Blob. */
async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    img,
    cropArea.x, cropArea.y, cropArea.width, cropArea.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/jpeg', 0.9)
  );
}

export function AvatarUploader({ currentUrl, onUploaded }: AvatarUploaderProps) {
  const { user } = useAuth();
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Ficheiro demasiado grande. Máximo ${MAX_SIZE_MB} MB.`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são aceites.');
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setRawSrc(url);
  };

  const handleUpload = async () => {
    if (!rawSrc || !croppedArea || !user?.id) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(rawSrc, croppedArea);
      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) { setError('Erro ao carregar imagem.'); return; }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUploaded(`${data.publicUrl}?t=${Date.now()}`);
      if (rawSrc) URL.revokeObjectURL(rawSrc);
      setRawSrc(null);
    } catch {
      setError('Erro ao processar imagem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {currentUrl ? (
        <img src={currentUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Camera className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Alterar foto
        </Button>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Máx. 2 MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Selecionar foto de perfil"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Crop dialog */}
      <Dialog open={!!rawSrc} onOpenChange={(open) => { if (!open) { if (rawSrc) URL.revokeObjectURL(rawSrc); setRawSrc(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Recortar foto</DialogTitle></DialogHeader>
          {rawSrc && (
            <div className="relative h-64 bg-black rounded overflow-hidden">
              <Cropper
                image={rawSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}
          <div className="px-2">
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              aria-label="Zoom da foto"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRawSrc(null)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {uploading ? 'A carregar...' : 'Guardar foto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
