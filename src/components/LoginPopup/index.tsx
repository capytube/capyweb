import { useEffect } from 'react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import Modal from '../Modal/Modal';

interface LoginPopupProps {
  isOpen: boolean;
  setIsOpen: (value: React.SetStateAction<boolean>) => void;
  message?: string;
}

const LoginPopup = ({ isOpen, setIsOpen, message }: LoginPopupProps) => {
  // overriding dynamic widget styling
  const host = document.querySelectorAll('#dynamic-widget')[1];
  useEffect(() => {
    if (host) {
      const style = document.createElement('style');
      style.innerHTML = '.custom-btn { width: 100%; }';
      host?.shadowRoot?.appendChild(style);
    }
  }, [host]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      className="md:max-w-[550px] max-w-[300px] shadow-characterCard"
    >
      <div className="flex flex-col md:gap-y-6 gap-y-4 items-center justify-center">
        <h4 className="font-ADLaM md:text-[28px] text-[18px] md:leading-8 text-chocoBrown">
          {message ?? 'You are not logged in, Please Log in...'}
        </h4>

        <div className="flex gap-x-6 items-center justify-center">
          <button
            type="button"
            className="relative rounded-lg text-white font-ADLaM md:text-3xl text-xl px-4 py-2.5 bg-darkOrange shadow-buttonShadow max-w-[129px]"
            onClick={(e) => {
              e.preventDefault();
              setIsOpen(false);
            }}
          >
            <div className="absolute top-2 opacity-0 w-full">
              <DynamicWidget
                buttonClassName="custom-btn"
                innerButtonComponent={<p className='absolute top-2 opacity-0 w-full' style={{ width: '100px', height: '100%' }}>Login</p>}
              />
            </div>
            <span className="z-10">Login</span>
          </button>
          <button
            className="rounded-lg text-white font-ADLaM md:text-3xl text-xl px-4 py-2.5 bg-darkOrange shadow-buttonShadow max-w-[129px]"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LoginPopup;
