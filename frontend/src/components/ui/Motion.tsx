import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import React, { useEffect, useState } from 'react';

// ==================== Reduced Motion Detection ====================

// Custom hook to detect if user prefers reduced motion or is on mobile
export const useMotionPreference = () => {
    const prefersReducedMotion = useReducedMotion();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Detect mobile
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Detect if PWA standalone mode (often indicates mobile usage)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) {
            setIsMobile(true);
        }

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return { prefersReducedMotion, isMobile, shouldReduceMotion: prefersReducedMotion };
};

// ==================== Animation Variants ====================

// Fade In/Out
export const fadeVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
};

// Fade Up (for cards, sections)
export const fadeUpVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
};

// Fade Down
export const fadeDownVariants: Variants = {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
};

// Scale (for modals, dialogs)
export const scaleVariants: Variants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
};

// Scale Up (popup from bottom)
export const scaleUpVariants: Variants = {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: 10 }
};

// Slide from Left (for sidebars)
export const slideLeftVariants: Variants = {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' }
};

// Slide from Right
export const slideRightVariants: Variants = {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' }
};

// Slide from Bottom (for bottom sheets)
export const slideUpVariants: Variants = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' }
};

// Stagger container (for lists) - optimized for mobile
export const staggerContainerVariants: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.04, // Faster stagger on mobile
            delayChildren: 0.05
        }
    },
    exit: {
        transition: {
            staggerChildren: 0.02,
            staggerDirection: -1
        }
    }
};

// Stagger item - optimized for mobile performance
export const staggerItemVariants: Variants = {
    initial: { opacity: 0, y: 12 },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 400, // Higher stiffness = faster
            damping: 28
        }
    },
    exit: { opacity: 0, y: -8 }
};

// Page transition - optimized for mobile
export const pageVariants: Variants = {
    initial: { opacity: 0, y: 6 },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.25,
            ease: [0.25, 0.1, 0.25, 1]
        }
    },
    exit: {
        opacity: 0,
        y: -6,
        transition: {
            duration: 0.15
        }
    }
};

// Backdrop
export const backdropVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
};

// Spring transition configs - optimized for mobile
export const springTransition = {
    type: 'spring' as const,
    stiffness: 400,
    damping: 35
};

export const smoothTransition = {
    duration: 0.25,
    ease: [0.25, 0.1, 0.25, 1]
};

export const fastTransition = {
    duration: 0.15,
    ease: 'easeOut'
};

// ==================== Motion Components ====================

interface MotionProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    duration?: number;
    onClick?: () => void;
}

// Fade wrapper
export const MotionFade: React.FC<MotionProps> = ({
    children,
    className = '',
    delay = 0,
    duration = 0.3
}) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration, delay, ease: 'easeOut' }}
        className={className}
    >
        {children}
    </motion.div>
);

// Fade Up wrapper
export const MotionFadeUp: React.FC<MotionProps> = ({
    children,
    className = '',
    delay = 0,
    duration = 0.4
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
        className={className}
    >
        {children}
    </motion.div>
);

// Scale wrapper (for cards, buttons)
export const MotionScale: React.FC<MotionProps> = ({
    children,
    className = '',
    delay = 0
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
        className={className}
    >
        {children}
    </motion.div>
);

// Page wrapper with transition
export const MotionPage: React.FC<MotionProps> = ({ children, className = '' }) => (
    <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className={className}
    >
        {children}
    </motion.div>
);

// Stagger list container
export const MotionList: React.FC<MotionProps> = ({ children, className = '' }) => (
    <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={staggerContainerVariants}
        className={className}
    >
        {children}
    </motion.div>
);

// Stagger list item
export const MotionItem: React.FC<MotionProps> = ({ children, className = '' }) => (
    <motion.div
        variants={staggerItemVariants}
        className={className}
    >
        {children}
    </motion.div>
);

// Interactive button/card with hover and tap effects
interface MotionButtonProps extends MotionProps {
    whileHoverScale?: number;
    whileTapScale?: number;
}

export const MotionButton: React.FC<MotionButtonProps> = ({
    children,
    className = '',
    onClick,
    whileHoverScale = 1.02,
    whileTapScale = 0.98
}) => (
    <motion.div
        whileHover={{ scale: whileHoverScale }}
        whileTap={{ scale: whileTapScale }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={className}
        onClick={onClick}
    >
        {children}
    </motion.div>
);

// Card with lift effect on hover
export const MotionCard: React.FC<MotionProps & { index?: number }> = ({
    children,
    className = '',
    index = 0,
    onClick
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{
            duration: 0.4,
            delay: index * 0.05,
            ease: [0.25, 0.1, 0.25, 1]
        }}
        whileHover={{
            y: -4,
            boxShadow: '0 12px 40px -12px rgba(0, 0, 0, 0.15)'
        }}
        className={className}
        onClick={onClick}
    >
        {children}
    </motion.div>
);

// Sidebar animation wrapper
export const MotionSidebar: React.FC<{ children: React.ReactNode; isOpen: boolean; className?: string }> = ({
    children,
    isOpen,
    className = ''
}) => (
    <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={className}
    >
        {children}
    </motion.aside>
);

// Overlay/Backdrop
export const MotionOverlay: React.FC<{ onClick?: () => void; className?: string }> = ({
    onClick,
    className = ''
}) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        className={className}
    />
);

// Modal wrapper
export const MotionModal: React.FC<MotionProps> = ({ children, className = '' }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{
            type: 'spring',
            stiffness: 350,
            damping: 30
        }}
        className={className}
    >
        {children}
    </motion.div>
);

// Row slide animation for tables/lists
export const MotionRow: React.FC<MotionProps & { index?: number }> = ({
    children,
    className = '',
    index = 0
}) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{
            duration: 0.3,
            delay: index * 0.03,
            ease: 'easeOut'
        }}
        className={className}
    >
        {children}
    </motion.div>
);

// Export AnimatePresence for convenience
export { motion, AnimatePresence };
