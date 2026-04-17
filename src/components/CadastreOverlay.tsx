import { WMSTileLayer } from 'react-leaflet';

export default function CadastreOverlay() {
  return (
    <WMSTileLayer
      url="https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0"
      layers="KadastraleKaart"
      format="image/png"
      transparent
      opacity={0.7}
      maxZoom={22}
      attribution='&copy; <a href="https://www.kadaster.nl">Kadaster</a>'
    />
  );
}
