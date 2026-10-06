import { Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Layout from "./components/Layout.jsx";
import Chat from "./pages/Chat.jsx";
import Doctors from "./pages/Doctors.jsx";
import DoctorProfile from "./pages/DoctorProfile.jsx";
import MyAppointments from "./pages/MyAppointments.jsx";
import CheckIns from "./pages/CheckIns.jsx";
import CheckIn from "./pages/CheckIn.jsx";
import Medicines from "./pages/Medicines.jsx";
import Medicine from "./pages/Medicine.jsx";
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
            <Route path="/doctors/:id" element={<DoctorProfile />} />
            <Route path="/appointments" element={<MyAppointments />} />
            <Route path="/check-in" element={<CheckIns />} />
            <Route path="/check-in/:id" element={<CheckIn />} />
            <Route path="/medicines" element={<Medicines />} />
            <Route path="/medicines/:slug" element={<Medicine />} />
            <Route path="*" element={<Chat />} />
          </Route>
        </Routes>
      </ChatProvider>
    </MotionConfig>
  );
}
