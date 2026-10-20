import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * เลื่อนหน้าจอขึ้นจุดบนสุดเสมอทุกครั้งที่มีการเปลี่ยนหน้า (Route Change)
 * รองรับทุกเบราว์เซอร์ ทั้งมือถือ แท็บเล็ต ไอแพด และคอมพิวเตอร์
 */
export const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // 1. เลื่อน window หลักขึ้นจุดบนสุดทันที (Top: 0, Left: 0)
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });

    // 2. เลื่อน documentElement และ document.body ขึ้นบนสุดสำหรับเบราว์เซอร์มือถือและ iOS Safari
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 3. เลื่อน main container ขึ้นบนสุดหากมี overflow ภายใน
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  }, [pathname, search]);

  return null;
};
