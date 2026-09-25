'use client';

import { useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/format';

export default function ProductImage({ src, alt, className = '', ...props }) {
  const [imageSrc, setImageSrc] = useState(mediaUrl(src));

  useEffect(() => setImageSrc(mediaUrl(src)), [src]);

  return (
    <img
      src={imageSrc}
      alt={alt || 'صورة المنتج'}
      className={className}
      onError={() => setImageSrc('/placeholder.svg')}
      {...props}
    />
  );
}
