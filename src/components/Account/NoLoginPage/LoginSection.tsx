type Props = {
  setLoggedIn: Function;
};

function LoginSection({ setLoggedIn }: Props) {
  return (
    <div className="bg-grassGreen md:pt-10 md:pb-20 py-8 md:px-0 px-4">
      <div className="max-w-[1328px] flex flex-col justify-center items-center md:gap-y-14 gap-y-4 mx-auto">
        <h1 className="font-hanaleiFill md:text-titleSize text-titleSizeSM text-darkGreen">
          Join us for free
        </h1>
        <div className="md:max-w-max max-w-[305px]">
          <img
            src="/src/assets/account/noLogin/play-cappys.png"
            alt="play"
            className="md:max-h-max max-h-[150px]"
          />
        </div>
        <div className="flex flex-col gap-y-6">
          <h3 className="text-chocoBrown font-semibold text-center md:text-[36px] md:leading-[44px] text-[22px] leading-[26px] font-ADLaM">
            Join Capytube and Start Watching Capybaras Today!
          </h3>
          <p className="text-center font-commissioner text-chocoBrown md:text-titleSizeSM text-sm">
            Sign up for a free Capytube membership and get instant access to our
            live public streams, featuring the cutest capybaras in their daily
            antics!
          </p>
        </div>
        <div className="flex md:flex-row flex-col md:gap-x-14">
          <div className="px-4 max-w-md">
            <img
              src="/src/assets/account/noLogin/capy-window.png"
              alt="winodw"
              className="md:max-h-max max-h-[150px] mx-auto"
            />
            <p className="md:pt-10 pt-4 font-ADLaM md:text-[28px] md:leading-8 text-sm text-center text-chocoBrown font-semibold md:pb-10 pb-6">
              Free Public Streams
            </p>
            <p className="font-commissioner md:text-titleSizeSM text-sm text-center text-chocoBrown">
              Watch our capybara gang as they play, munch, and relax—all for
              free! Your free membership gets you access to our rotating camera
              feed, so you never miss a moment.
            </p>
          </div>
          <div className="px-4 max-w-md">
            <img
              className="mx-auto md:max-h-max max-h-[150px]"
              src="/src/assets/account/noLogin/capycoin.png"
              alt="capycoin"
            />
            <p className="md:pt-10 pt-4 font-ADLaM md:text-[28px] md:leading-8 text-sm text-center text-chocoBrown font-semibold md:pb-10 pb-6">
              Earn Capy Coins
            </p>
            <p className="font-commissioner md:text-titleSizeSM text-sm text-center text-chocoBrown">
              Connect your wallet to start earning Capy Coins just by watching!
              Use your coins to join fun games and interact with the capybaras.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rotate-1 bg-darkGreen font-ADLaM text-white md:text-3xl md:py-2.5 py-1 px-4 rounded-lg md:shadow-loginShadow shadow-buttonShadow"
          onClick={() => setLoggedIn(true)}
        >
          Log in or Create account
        </button>
      </div>
    </div>
  );
}

export default LoginSection;
