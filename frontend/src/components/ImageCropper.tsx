import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';

interface ImageCropperProps {
    imageUrl: string;
    onCrop: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ 
    imageUrl, 
    onCrop, 
    onCancel
}) => {
    const [scale, setScale] = useState(1);
    const [minScale, setMinScale] = useState(0.1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate initial scale to fit image in crop area
    useEffect(() => {
        if (imageLoaded && imageRef.current && containerRef.current) {
            const img = imageRef.current;
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            
            // Crop circle is 80% of container (40% radius * 2)
            const cropDiameter = Math.min(containerRect.width, containerRect.height) * 0.8;
            
            // Calculate scale to fit the whole image inside the crop circle
            const imgAspect = img.naturalWidth / img.naturalHeight;
            let fitScale: number;
            
            if (imgAspect > 1) {
                // Landscape image - fit by width
                fitScale = cropDiameter / img.naturalWidth;
            } else {
                // Portrait image - fit by height
                fitScale = cropDiameter / img.naturalHeight;
            }
            
            // Set min scale to allow seeing the whole image (with some margin)
            const calculatedMinScale = fitScale * 0.5;
            setMinScale(Math.max(0.05, calculatedMinScale));
            
            // Set initial scale to show the whole image with a bit of margin
            const initialScale = fitScale * 1.2;
            setScale(Math.max(0.1, Math.min(1.5, initialScale)));
        }
    }, [imageLoaded]);

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }, [isDragging, dragStart]);

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    }, [isDragging, dragStart]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.max(minScale, Math.min(3, prev + delta)));
    };

    const handleCrop = () => {
        if (!imageRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const outputSize = 256; // Output size for avatar
        canvas.width = outputSize;
        canvas.height = outputSize;

        const img = imageRef.current;
        const cropArea = containerRef.current?.getBoundingClientRect();
        
        if (!cropArea) return;

        // Calculate the crop region
        const cropSize = Math.min(cropArea.width, cropArea.height) * 0.8;
        const imgRect = img.getBoundingClientRect();
        
        // Clear canvas
        ctx.clearRect(0, 0, outputSize, outputSize);
        
        // Create circular clip
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.clip();

        // Calculate source coordinates
        const scaleRatio = img.naturalWidth / imgRect.width;
        
        const centerX = cropArea.width / 2;
        const centerY = cropArea.height / 2;
        
        const srcX = ((centerX - imgRect.left + cropArea.left) - cropSize / 2) * scaleRatio;
        const srcY = ((centerY - imgRect.top + cropArea.top) - cropSize / 2) * scaleRatio;
        const srcWidth = cropSize * scaleRatio;
        const srcHeight = cropSize * scaleRatio;

        // Apply rotation
        ctx.save();
        ctx.translate(outputSize / 2, outputSize / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-outputSize / 2, -outputSize / 2);

        try {
            ctx.drawImage(
                img,
                Math.max(0, srcX),
                Math.max(0, srcY),
                Math.min(srcWidth, img.naturalWidth - srcX),
                Math.min(srcHeight, img.naturalHeight - srcY),
                0,
                0,
                outputSize,
                outputSize
            );
        } catch (e) {
            // Fallback: draw the entire image scaled
            ctx.drawImage(img, 0, 0, outputSize, outputSize);
        }

        ctx.restore();

        // Convert to blob
        canvas.toBlob((blob) => {
            if (blob) {
                onCrop(blob);
            }
        }, 'image/jpeg', 0.9);
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center">
            {/* Header - hidden on mobile, controls are at bottom */}
            <div className="absolute top-0 left-0 right-0 hidden md:flex items-center justify-between p-4 pt-6 bg-gradient-to-b from-black/50 to-transparent safe-area-top">
                <button
                    onClick={onCancel}
                    className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
                <h3 className="text-white font-medium">Cắt ảnh đại diện</h3>
                <button
                    onClick={handleCrop}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                >
                    <Check size={24} />
                </button>
            </div>

            {/* Mobile Header - just title */}
            <div className="absolute top-0 left-0 right-0 flex md:hidden items-center justify-center p-4 pt-12 bg-gradient-to-b from-black/50 to-transparent">
                <h3 className="text-white font-medium">Cắt ảnh đại diện</h3>
            </div>

            {/* Crop Area */}
            <div 
                ref={containerRef}
                className="relative w-full h-[60vh] overflow-hidden cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Image */}
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Crop preview"
                    className="absolute max-w-none"
                    style={{
                        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale}) rotate(${rotation}deg)`,
                        left: '50%',
                        top: '50%',
                        transformOrigin: 'center'
                    }}
                    draggable={false}
                    onLoad={handleImageLoad}
                />

                {/* Overlay with circle cutout */}
                <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full">
                        <defs>
                            <mask id="cropMask">
                                <rect width="100%" height="100%" fill="white" />
                                <circle cx="50%" cy="50%" r="40%" fill="black" />
                            </mask>
                        </defs>
                        <rect 
                            width="100%" 
                            height="100%" 
                            fill="rgba(0,0,0,0.6)" 
                            mask="url(#cropMask)" 
                        />
                        <circle 
                            cx="50%" 
                            cy="50%" 
                            r="40%" 
                            fill="none" 
                            stroke="white" 
                            strokeWidth="2"
                            strokeDasharray="8 4"
                        />
                    </svg>
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black/80 to-transparent safe-area-bottom">
                {/* Confirm button for mobile - large and prominent */}
                <div className="flex justify-center mb-4 md:hidden">
                    <button
                        onClick={handleCrop}
                        className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                        <Check size={20} />
                        Xác nhận
                    </button>
                </div>

                <div className="flex items-center justify-center gap-6">
                    {/* Zoom Out */}
                    <button
                        onClick={() => setScale(prev => Math.max(minScale, prev - 0.1))}
                        className="p-3 text-white hover:bg-white/20 rounded-full transition-colors"
                    >
                        <ZoomOut size={24} />
                    </button>

                    {/* Zoom Slider */}
                    <input
                        type="range"
                        min={minScale}
                        max="3"
                        step="0.05"
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        className="w-32 accent-blue-500"
                    />

                    {/* Zoom In */}
                    <button
                        onClick={() => setScale(prev => Math.min(3, prev + 0.1))}
                        className="p-3 text-white hover:bg-white/20 rounded-full transition-colors"
                    >
                        <ZoomIn size={24} />
                    </button>

                    {/* Rotate */}
                    <button
                        onClick={() => setRotation(prev => (prev + 90) % 360)}
                        className="p-3 text-white hover:bg-white/20 rounded-full transition-colors"
                    >
                        <RotateCw size={24} />
                    </button>
                </div>

                <p className="text-center text-white/60 text-sm mt-3">
                    Kéo để di chuyển • Cuộn/pinch để zoom
                </p>

                {/* Cancel button for mobile */}
                <div className="flex justify-center mt-4 md:hidden">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 text-white/80 hover:text-white transition-colors"
                    >
                        Hủy
                    </button>
                </div>
            </div>

            {/* Hidden canvas for cropping */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default ImageCropper;
