import React, { ReactNode } from "react";
import styles from "./Modal.module.css";
import closeIcon from "../../assets/icons/close.svg";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, width, className }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modal} ${className}`} style={{ width }}>
        <button className={styles.closeButton} onClick={onClose}>
          <img src={closeIcon} alt="close" width={16} />
        </button>
        <div className={styles.modalContent}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
