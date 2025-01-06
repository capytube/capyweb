// src/components/ProfilePage.tsx

import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { useAccount } from 'wagmi';

import { PencilIcon } from './Icons';

import NftSection from './NftSection';
import WalletSection from './WalletSection/WalletSection';
import Footer from '../Footer/Footer';
import NotLoggedInPage from './NoLoginPage/NotLoggedInPage';
import NotPremiumPage from './NotPremium/NotPremiumPage';
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { userAtom } from '../../store/atoms/userAtom';
import Modal from '../Modal/Modal';
import UpdateProfile from './UpdateProfile/UpdateProfile';

const ProfilePage: React.FC = () => {
  const isLoggedIn = useIsLoggedIn();
  const { isConnected } = useAccount();

  const [userData] = useAtom(userAtom);

  const [openNameModal, setOpenNameModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isLoggedIn ? (
    isConnected ? (
      <>
        <div className="bg-grassGreen lg:py-10 py-8">
          <h1 className="font-hanaleiFill text-darkGreen md:text-titleSize text-titleSizeSM text-center md:pb-6 pb-4">
            My Account
          </h1>
          <form className="flex md:flex-row flex-col gap-x-6 gap-y-6 justify-center p-6">
            <div className="flex flex-col gap-y-2">
              <label htmlFor="displayName" className="text-chocoBrown font-ADLaM sm:text-xl text-xs">
                Display name:
              </label>
              <div className="flex gap-x-4 items-center">
                <input
                  name="displayName"
                  type="text"
                  disabled={!!userData?.username}
                  value={userData?.username || ''}
                  className="border-2 bg-white border-chocoBrown rounded-[4px] outline-none px-3 sm:py-2.5 py-1.5 font-commissioner max-h-11 w-full lg:min-w-[316px] lg:max-w-[316px] max-w-[266px]"
                />
                <button type="button" onClick={() => setOpenNameModal(true)}>
                  <PencilIcon />
                </button>
              </div>
            </div>
          </form>
        </div>
        <NftSection />
        <WalletSection premium={isConnected} />
        {!isMobile && <Footer />}
        <Modal
          isOpen={openNameModal}
          onClose={() => setOpenNameModal(false)}
          width="400px"
          className="md:max-w-[550px] max-w-[300px] shadow-characterCard"
        >
          <UpdateProfile
            onClose={() => {
              setOpenNameModal(false);
            }}
          />
        </Modal>
      </>
    ) : (
      <>
        <NotPremiumPage />
        {!isMobile && <Footer />}
      </>
    )
  ) : (
    <>
      <NotLoggedInPage />
      {!isMobile && <Footer />}
    </>
  );
};

export default ProfilePage;
