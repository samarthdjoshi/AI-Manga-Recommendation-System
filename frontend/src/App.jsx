import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import LoadingSpinner from "./components/LoadingSpinner";
import HomePage from "./pages/HomePage";

// Lazy-loaded routes for instant initial load and tiny bundle size
const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const Top100Page = lazy(() => import("./pages/Top100Page"));
const ManhwaPage = lazy(() => import("./pages/ManhwaPage"));
const MangaDetailPage = lazy(() => import("./pages/MangaDetailPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UserPublicProfilePage = lazy(() => import("./pages/UserPublicProfilePage"));
const TrendingPage = lazy(() => import("./pages/TrendingPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

import ChatWidget from "./components/ChatWidget";
import ThemeSelectorModal from "./components/ThemeSelectorModal";
import { ChatPageProvider } from "./context/ChatPageContext";
import { ThemeProvider } from "./context/ThemeProvider";

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ChatPageProvider>
        <div className="min-h-screen bg-ink text-foreground transition-colors duration-200 w-full overflow-x-hidden">
          <Header />
          <main className="mx-auto max-w-[1440px] px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 min-h-[calc(100vh-80px)] w-full overflow-x-hidden">
            <Suspense fallback={<PageFallback />}>
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
            </Suspense>
          </main>
          <ChatWidget />
          <ThemeSelectorModal />
        </div>
      </ChatPageProvider>
    </ThemeProvider>
  );
}
