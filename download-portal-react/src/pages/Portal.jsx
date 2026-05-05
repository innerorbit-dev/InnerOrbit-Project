import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import SocialPrivacyComparison from '../components/SocialPrivacyComparison';
import FeaturesSection from '../components/FeaturesSection';
import DownloadSection from '../components/DownloadSection';
import Footer from '../components/Footer';

export default function Portal() {
    return (
        <div style={{ overflowX: 'hidden' }}>
            <Navbar />
            <main>
                <HeroSection />
                <SocialPrivacyComparison />
                <FeaturesSection />
                <DownloadSection />
            </main>
            <Footer />
        </div>
    );
}
