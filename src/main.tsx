import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// leaflet 样式必须引入，否则 marker 图标 & 瓦片底图会错位
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import App from './App.tsx';

// 修复默认 Leaflet icon 在打包后找不到的问题
// （因为 Vite 会处理静态资源，但 L.Icon.Default.imagePath 仍指向旧路径）
import L from 'leaflet';
// 兜底默认 marker 图标 URL；我们实际都用 divIcon，这里只防回退
(L.Icon.Default.prototype as any)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
