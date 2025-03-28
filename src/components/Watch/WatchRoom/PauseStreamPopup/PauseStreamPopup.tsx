import Modal from '../../../Modal/Modal';

interface PauseStreamPopupProps {
  isOpen: boolean;
  setIsOpen: (value: React.SetStateAction<boolean>) => void;
  handlePlay: () => void;
}

const PauseStreamPopup = ({ isOpen, setIsOpen, handlePlay }: PauseStreamPopupProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      hideClose
      className="md:max-w-[550px] max-w-[300px] shadow-characterCard"
    >
      <div className="flex flex-col md:gap-y-6 gap-y-4 items-center justify-center">
        <h4 className="font-ADLaM md:text-[28px] text-[18px] md:leading-8 text-chocoBrown">Are you still watching ?</h4>

        <div className="flex gap-x-4 items-center justify-center">
          <button
            className="rounded-lg text-white font-ADLaM md:text-3xl text-xl px-4 py-2.5 bg-darkOrange shadow-buttonShadow"
            onClick={() => {
              setIsOpen(false);
              handlePlay();
            }}
          >
            Yes
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PauseStreamPopup;
