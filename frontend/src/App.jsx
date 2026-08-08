import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import MangaDetailPage from "./pages/MangaDetailPage";

export default function App() {
  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/manga/:goldId" element={<MangaDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
