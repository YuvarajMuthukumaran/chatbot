import { Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Layout from "./components/Layout.jsx";
import Chat from "./pages/Chat.jsx";
import Doctors from "./pages/Doctors.jsx";
import { ChatProvider } from "./lib/chatStore.jsx";

export default function App() {
  return (
    // reducedMotion="user": framer-motion's animations honor the OS "reduce
    // motion" setting too, not just the CSS ones in index.css.
    <MotionConfig reducedMotion="user">
      <ChatProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/doctors" element={<Doctors />} />
            <Route path="*" element={<Chat />} />
          </Route>
        </Routes>
      </ChatProvider>
    </MotionConfig>
  );
}
