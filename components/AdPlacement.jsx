'use client';

import Script from 'next/script';

// Wadah penempatan iklan terisolasi (Adsterra/Monetag).
// - Div khusus "ad-placement-container" selalu dirender di bawah pemutar.
// - Skrip jaringan iklan dimuat dengan next/script strategy="lazyOnload"
//   agar dievaluasi asinkron setelah halaman interaktif: tidak memblokir
//   main thread dan tidak menggagalkan mounting komponen.
// - URL skrip diisi lewat env (kosong = hanya wadah penanda yang tampil):
//     NEXT_PUBLIC_ADSTERRA_SRC / NEXT_PUBLIC_MONETAG_SRC
export default function AdPlacement() {
  const srcs = [process.env.NEXT_PUBLIC_ADSTERRA_SRC, process.env.NEXT_PUBLIC_MONETAG_SRC].filter(
    Boolean
  );

  return (
    <>
      <div
        id="ad-placement-container"
        className="ad-placement-container"
        style={{
          margin: '16px 0',
          minHeight: 80,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1.5px dashed var(--ln)',
          borderRadius: 20,
          color: 'var(--mu)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}
        data-ad-slot="below-player"
      >
        {srcs.length === 0 ? 'Ad Placement' : null}
      </div>
      {srcs.map((src, i) => (
        <Script key={i} src={src} strategy="lazyOnload" />
      ))}
    </>
  );
}
