import { useEffect, useState } from 'react';
import Footer from './Footer/Footer';
import aboutOneImg from '../assets/aboutOne.png';
import aboutTwoImg from '../assets/aboutTwo.png';

const AboutUs = () => {
  // states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);

  // functions
  const handleScrollTop = () => {
    const ele = document.getElementById('about-us');
    ele?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // effects
  useEffect(() => {
    handleScrollTop();
    return () => {
      handleScrollTop();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <div id="about-us" className="py-10 pb-20 md:px-0 px-4">
        <div className="flex flex-col items-center mb-4">
          <h1 className="font-hanaleiFill md:text-titleSize text-titleSizeSM text-chocoBrown">CapyCoin</h1>
        </div>

        <div className="max-w-[1075px] flex flex-col justify-center items-center md:gap-y-14 gap-y-4 mx-auto">
          {/* CapyTube Section */}
          <section className="font-commissioner sm:text-2xl text-xl text-center flex flex-col gap-4">
            <h4 className="text-center font-ADLaM text-chocoBrown md:text-4xl text-2xl font-semibold pb-6">
              Your Gateway to CapyTube
            </h4>
            <p>
              Welcome to <strong>CapyCoin</strong>, your exclusive entry into the charming world of capybara live
              streams!
            </p>
            <p>
              Here, you can watch your favorite capybara, <strong>Magnus</strong>, and participate in his everyday
              adventures. Our platform allows you to tip Magnus or even vote on tasks for him to complete using{' '}
              <strong>CapyCoins</strong>, our unique currency.
            </p>
            <p>
              On <strong>CapyTube</strong>, you’ll have the chance to guide Magnus through his activities, whether he’s
              lounging in a hot spring, munching on his favorite snacks, or exploring new territories.
            </p>
            <p>
              With <strong>CapyCoins</strong>, you don’t just watch Magnus — you actively participate in his life!
            </p>
            <div className="flex justify-center mt-6">
              <img src={aboutOneImg} alt="Magnus in his climbing gym" className="sm:w-3/4" />
            </div>
          </section>

          {/* Magnus Story Section */}
          <section className="font-commissioner sm:text-2xl text-xl flex flex-col gap-4">
            <h4 className="text-center font-ADLaM text-chocoBrown md:text-4xl text-2xl font-semibold pb-6">
              The Story of Magnus
            </h4>
            <p>
              Magnus is no ordinary capybara. Born in the north of Thailand, he’s the second-generation capybara in his
              lineage, with a rich history of travel and adventure. From Thailand to various countries around the world,
              Magnus has become a symbol of peace, relaxation, and joy for everyone he meets.
            </p>
            <p>
              Magnus is the star of our platform for a reason. Not only is he an adventurous capybara, but he’s also the
              heart and soul behind two major attractions:
            </p>
            <ul className="list-disc pl-10 flex flex-col gap-6">
              <li>
                <strong>Magnus' Capybara Café:</strong> A one-of-a-kind café experience where the theme and ambiance are
                all inspired by Magnus himself.
              </li>
              <li>
                <strong>Magnus' Climbing Gym:</strong> An adventurous, world-class climbing gym that brings Magnus'
                spirit of exploration and play to life.
              </li>
            </ul>
            <p>
              When he’s not running his café or gym, Magnus spends his time doing what he loves most —{' '}
              <strong>swimming</strong>, <strong>bathing in hot springs</strong>, and snacking on his favorite foods
              like <strong>apples</strong>, <strong>watermelons</strong>, <strong>cucumbers</strong>, and the occasional
              treat of <strong>banana peels</strong>. His all-time favorite, though, is <strong>carrot pudding</strong>.
            </p>
            <div className="flex justify-center mb-4">
              <img src={aboutTwoImg} alt="Magnus lounging in a hot spring" className="sm:w-2/4" />
            </div>
            <p>
              Though Magnus has many capybara friends, he’s <strong>incredibly tame</strong> and adores spending time
              with humans. In fact, he often prefers human companionship, soaking up the attention and love from
              everyone he meets. This makes him the perfect capybara to engage with our community and share his life
              with viewers worldwide.
            </p>
          </section>
        </div>
      </div>

      {!isMobile && <Footer />}
    </>
  );
};

export default AboutUs;
