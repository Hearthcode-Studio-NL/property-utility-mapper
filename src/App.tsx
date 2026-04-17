import { Route, Routes } from 'react-router-dom';
import Home from './routes/Home';
import Property from './routes/Property';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/property/:id" element={<Property />} />
    </Routes>
  );
}
