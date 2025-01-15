import React from 'react';
import { DropdownIcon } from './Icons';
import ChooseCapySection from './ChooseCapySection';
import GameSection from './GameSection';
import Footer from '../Footer/Footer';
import Modal from '../Modal/Modal';
import { CapyCoin } from '../Account/Icons';
import { CapybaraAtomType } from '../../store/atoms/capybaraAtom';
import VideoPlayer from '../VideoPlayer';

type Props = {};

function index({}: Props) {
  const coins = 10;
  const [selection, setSelection] = React.useState(1);
  const [selectedCapy, setSelectedCapy] = React.useState<{
    id: string;
    name: string;
    image: string;
  }>({ id: '', name: '', image: '' });

  const [openMenu, setOpenMenu] = React.useState(false);

  const [isTopupModal, setTopupModal] = React.useState(false);
  const [date, setDate] = React.useState('5 Nov 2024');
  const [dateMenu, setDateMenu] = React.useState(false);
  const [section, setSection] = React.useState(1);

  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 500);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const optionsStyle = 'text-left text-lg p-2';

  const handleSection = (e: any, selection: CapybaraAtomType) => {
    e.preventDefault();
    if (coins) {
      setSelectedCapy({
        id: selection?.id ?? '',
        name: selection?.name ?? '',
        image: selection?.profile_image_url ?? '',
      });
      setSection(2);
    } else {
      setTopupModal(true);
    }
  };

  return (
    <div>
      <div className="md:py-10 py-8 flex flex-col md:gap-y-6 gap-y-[18px] bg-grassGreen justify-center items-center">
        <h1 className="md:text-titleSize text-titleSizeSM font-hanaleiFill text-darkGreen">Play with Capy</h1>
        <p className="text-chocoBrown font-commissioner md:text-titleSizeSM text-sm">
          Spend your coins to play with our capybaras!
        </p>
        <div className="relative">
          <button
            type="button"
            className="flex bg-white md:py-2.5 py-1.5 px-4 border-2 border-chocoBrown rounded-lg items-center"
            onClick={() => setOpenMenu(!openMenu)}
          >
            <input
              type="text"
              value={selection === 1 ? 'Today’s session' : 'Past session'}
              disabled
              className="pr-2 outline-none md:max-w-[210px] max-w-44 text-chocoBrown font-ADLaM md:text-[28px] md:leading-8 text-base"
            />
            <DropdownIcon className={`${openMenu ? 'rotate-180' : ''}`} />
          </button>
          {openMenu ? (
            <div className="absolute z-40 flex flex-col bg-white w-full text-chocoBrown md:top-[70px] top-11 rounded-lg p-2">
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setSelection(1);
                  setOpenMenu(!openMenu);
                }}
              >
                Today’s session
              </button>
              <button
                type="button"
                className={optionsStyle}
                onClick={() => {
                  setSelection(2);
                  setOpenMenu(!openMenu);
                }}
              >
                Past session
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {selection === 1 ? (
        section !== 2 ? (
          <ChooseCapySection handleCapySelection={handleSection} />
        ) : (
          <GameSection
            capy={{ id: selectedCapy?.id, name: selectedCapy?.name, image: selectedCapy?.image }}
            handleSectionChange={() => setSection(1)}
          />
        )
      ) : (
        <div id="past-session" className="md:py-20 md:px-20 2xl:px-80">
          <div className="flex md:flex-row flex-col gap-y-4 gap-x-6 justify-center items-center">
            <p className="font-ADLaM md:text-2xl text-chocoBrown md:leading-6 text-xs font-semibold">
              Select the play:
            </p>
            <div className="md:block flex gap-x-4 items-center">
              <span className="font-dynapuff text-white bg-chocoBrown md:text-3xl md:py-4 py-1 md:px-8 px-2.5 rounded-full">
                Pick that snack
              </span>
              <span className="font-dynapuff text-chocoBrown bg-persimmon md:text-3xl md:py-4 py-1 md:px-8 px-2.5 rounded-full md:hidden">
                video call with cappy
              </span>
            </div>
            <div className="relative">
              <button
                type="button"
                className="relative flex items-center gap-x-2 md:text-[28px] md:leading-8 font-ADLaM text-chocoBrown border-2 border-chocoBrown px-4 md:py-3.5 py-1.5 w-full md:max-w-max max-w-[224px] justify-between rounded-lg bg-white"
                onClick={() => setDateMenu(!dateMenu)}
              >
                {date}
                <DropdownIcon className={`${dateMenu ? 'rotate-180' : ''}`} />
              </button>
              {dateMenu ? (
                <div className="absolute z-30 right-0 max-w-fit flex flex-col bg-white w-full text-chocoBrown md:top-[70px] top-11 rounded-lg p-2">
                  <button
                    type="button"
                    className={optionsStyle}
                    onClick={() => {
                      setDate('Date 1');
                      setDateMenu(!dateMenu);
                    }}
                  >
                    Date 1
                  </button>
                  <button
                    type="button"
                    className={optionsStyle}
                    onClick={() => {
                      setDate('Date 2');
                      setDateMenu(!dateMenu);
                    }}
                  >
                    Date 2
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="lg:max-w-5xl mx-auto mt-10">
            {/* <LivepeerPlayer streamId="fa7ahoikpf19u1e0" title="Magnus" /> */}
            <VideoPlayer
              streamId="play-page"
              videoUrl="https://magnus-video-public.s3.ap-southeast-1.amazonaws.com/capytube-stream.mp4"
            />
            {/* <img
          src={vidFrame}
          alt="frame"
          style={{ background: "black" }}
        /> */}
          </div>
        </div>
      )}

      {!isMobile ? <Footer /> : null}
      <Modal
        isOpen={isTopupModal}
        onClose={() => setTopupModal(false)}
        className="md:max-w-[350px] max-w-[240px] shadow-characterCard"
      >
        <div className="flex flex-col md:gap-y-6 gap-y-4 items-center justify-center">
          <h4 className="font-ADLaM md:text-[28px] md:leading-8 text-chocoBrown">Not enough coins</h4>
          <CapyCoin clx="size-20" />
          <h5 className="font-ADLaM md:text-[28px] md:leading-8 text-chocoBrown">Top up your coins</h5>
          <div className="flex flex-col md:gap-y-6 gap-y-2 w-full">
            {[
              { value: 20, price: 10 },
              { value: 50, price: 20 },
              { value: 100, price: 30 },
            ]?.map((item) => (
              <div className="flex gap-x-4 items-center w-full">
                <input
                  type="radio"
                  name="topup"
                  value={item.value}
                  className="text-chocoBrown accent-chocoBrown size-6"
                />
                <label htmlFor="topup" className="md:text-2xl text-sm text-chocoBrown font-commissioner">
                  {item?.value} coins ({item?.price} USD)
                </label>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="rounded-lg text-white font-ADLaM text-3xl px-4 py-2.5 bg-darkOrange shadow-buttonShadow max-w-[129px]"
          >
            Top up
          </button>
        </div>

        {/* <YourProfile /> */}
      </Modal>
    </div>
  );
}

export default index;
