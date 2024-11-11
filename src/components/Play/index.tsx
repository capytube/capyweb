import React from "react";
import { DropdownIcon } from "./Icons";
// import Footer from '../Footer/Footer';
import ChooseCapySection from "./ChooseCapySection";
import GameSection from "./GameSection";
import Footer from "../Footer/Footer";
import LivepeerPlayer from "../LivepeerPlayer";

type Props = {};

function index({}: Props) {
  const [selection, setSelection] = React.useState(1);
  const [openMenu, setOpenMenu] = React.useState(false);
  const [date, setDate] = React.useState("5 Nov 2024");
  const [dateMenu, setDateMenu] = React.useState(false);
  const [section, setSection] = React.useState(1);

  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 500);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const optionsStyle = "text-left text-lg p-2";

  const handleSection = (e: any, selection: string) => {
    e.preventDefault();
    console.log(selection);
    setSection(2);
  };

  return (
    <div>
      <div className="md:py-10 py-8 flex flex-col md:gap-y-6 gap-y-[18px] bg-grassGreen justify-center items-center">
        <h1 className="md:text-titleSize text-titleSizeSM font-hanaleiFill text-darkGreen">
          Play with Capy
        </h1>
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
              value={selection === 1 ? "Today’s session" : "Past session"}
              disabled
              className="pr-3 outline-none md:max-w-[210px] max-w-44 text-chocoBrown font-ADLaM md:text-[28px] md:leading-8 text-base"
            />
            <DropdownIcon className={`${openMenu ? "rotate-180" : ""}`} />
          </button>
          {openMenu ? (
            <div className="absolute flex flex-col bg-white w-full text-chocoBrown top-[70px] rounded-lg p-2">
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
          <GameSection handleSectionChange={() => setSection(1)} />
        )
      ) : (
        <div id="past-session" className="md:py-20 md:px-80">
          <div className="flex md:flex-row flex-col gap-y-4 gap-x-6 justify-center items-center relative">
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
            <button
              type="button"
              className="flex items-center gap-x-2 md:text-[28px] md:leading-8 font-ADLaM text-chocoBrown border-2 border-chocoBrown px-4 md:py-3.5 py-1.5 w-full md:max-w-max max-w-[224px] justify-between rounded-lg bg-white"
              onClick={() => setDateMenu(!dateMenu)}
            >
              {date}
              <DropdownIcon className={`${dateMenu ? "rotate-180" : ""}`} />
            </button>
            {dateMenu ? (
              <div className="absolute right-0 max-w-fit flex flex-col bg-white w-full text-chocoBrown top-[70px] rounded-lg p-2">
                <button
                  type="button"
                  className={optionsStyle}
                  onClick={() => {
                    setDate("Date 1");
                    setDateMenu(!dateMenu);
                  }}
                >
                  Date 1
                </button>
                <button
                  type="button"
                  className={optionsStyle}
                  onClick={() => {
                    setDate("Date 2");
                    setDateMenu(!dateMenu);
                  }}
                >
                  Date 2
                </button>
              </div>
            ) : null}
          </div>
          <div className="lg:max-w-5xl flex justify-center mx-auto mt-10">
            <LivepeerPlayer streamId="fa7ahoikpf19u1e0" title="Magnus" />
            {/* <img
          src={vidFrame}
          alt="frame"
          style={{ background: "black" }}
        /> */}
          </div>
        </div>
      )}

      {!isMobile ? <Footer /> : null}
    </div>
  );
}

export default index;
