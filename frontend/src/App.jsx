import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import DiscoverPage from "./pages/DiscoverPage";
import Top100Page from "./pages/Top100Page";
import ManhwaPage from "./pages/ManhwaPage";
import MangaDetailPage from "./pages/MangaDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FavoritesPage from "./pages/FavoritesPage";
import LibraryPage from "./pages/LibraryPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import UserPublicProfilePage from "./pages/UserPublicProfilePage";
import TrendingPage from "./pages/TrendingPage";
import SearchPage from "./pages/SearchPage";
import NotificationsPage from "./pages/NotificationsPage";
import ChatWidget from "./components/ChatWidget";
import ThemeSelectorModal from "./components/ThemeSelectorModal";
import { ChatPageProvider } from "./context/ChatPageContext";
import { ThemeProvider } from "./context/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <ChatPageProvider>
        <div className="min-h-screen bg-ink text-foreground transition-colors duration-200 w-full overflow-x-hidden">
          <Header />
          <main className="mx-auto max-w-[1440px] px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 min-h-[calc(100vh-80px)] w-full overflow-x-hidden">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/top-100" element={<Top100Page />} />
              <Route path="/manhwa" element={<ManhwaPage />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/manga/:goldId" element={<MangaDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/recommendations" element={<RecommendationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/:tab" element={<SettingsPage />} />
              <Route path="/user/:username" element={<UserPublicProfilePage />} />
              <Route path="/user/:username/:subtab" element={<UserPublicProfilePage />} />
            </Routes>
          </main>
          <ChatWidget />
          <ThemeSelectorModal />
        </div>
      </ChatPageProvider>
    </ThemeProvider>
  );
}
