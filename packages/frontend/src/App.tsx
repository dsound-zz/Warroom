import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Today } from './pages/Today.js';
import { Pipeline } from './pages/Pipeline.js';
import { Companies } from './pages/Companies.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="companies" element={<Companies />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
