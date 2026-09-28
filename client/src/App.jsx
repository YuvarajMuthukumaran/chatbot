import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Chat from "./pages/Chat.jsx";
import Doctors from "./pages/Doctors.jsx";
import DoctorProfile from "./pages/DoctorProfile.jsx";
import MyAppointments from "./pages/MyAppointments.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id" element={<DoctorProfile />} />
        <Route path="/appointments" element={<MyAppointments />} />
        <Route path="*" element={<Chat />} />
      </Route>
    </Routes>
  );
}
