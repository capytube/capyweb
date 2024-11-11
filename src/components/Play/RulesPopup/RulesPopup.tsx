import React from 'react';
import { CancelIcon } from '../../Account/Icons';

type Props = {
  isOpen: boolean;
  setIsOpen: Function;
  content: React.ReactNode;
  clx?: string; // className for the parent component to apply custom styles
};

export default function RulesPopup({ isOpen, setIsOpen, content, clx }: Props) {
  return isOpen ? (
    <div
      className={`absolute top-0 bg-white p-4 rounded-lg flex flex-col md:gap-y-6 gap-y-4 text-chocoBrown max-w-lg border-4 border-chocoBrown ${clx}`}
    >
      <div className="flex justify-between items-center gap-y-4 font-ADLaM  md:leading-8 md:text-[28px] text-xl font-semibold">
        Rules
        <button type="button" onClick={() => setIsOpen(false)}>
          <CancelIcon />
        </button>
      </div>
      <p className="md:text-2xl text-lg font-semibold font-ADLaM">How to play:</p>
      {content}
    </div>
  ) : null;
}
