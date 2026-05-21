import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { C } from '../lib/constants'
import { Btn } from './UI'

function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
    image.src = imageSrc
  })
}

export default function AvatarCrop({ file, onConfirm, onCancel }) {
  const [crop,       setCrop]       = useState({ x: 0, y: 0 })
  const [zoom,       setZoom]       = useState(1)
  const [croppedArea, setCroppedArea] = useState(null)
  const imageSrc = URL.createObjectURL(file)

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  const confirm = async () => {
    const blob = await getCroppedImg(imageSrc, croppedArea)
    onConfirm(blob)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: 8, overflow: 'hidden', width: 400, boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        
        {/* Titre */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14, color: C.text }}>
          Recadrer la photo de profil
        </div>

        {/* Zone de crop */}
        <div style={{ position: 'relative', width: 400, height: 400, background: '#222' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textMid, marginBottom: 8 }}>Zoom</div>
          <input
            type="range"
            min={1} max={3} step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.accentDk }}
          />
        </div>

        {/* Boutons */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel} variant="ghost">Annuler</Btn>
          <Btn onClick={confirm} variant="yellow">Confirmer</Btn>
        </div>
      </div>
    </div>
  )
}