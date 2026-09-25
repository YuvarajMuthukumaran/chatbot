import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Chat from "./pages/Chat.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="*" element={<Chat />} />
      </Route>
    </Routes>
  );
}
