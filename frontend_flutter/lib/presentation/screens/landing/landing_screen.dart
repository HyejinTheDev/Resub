import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0C0D14).withValues(alpha: 0.8),
        border: const Border(
          bottom: BorderSide(color: Colors.white12, width: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Logo
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.mic_none_outlined,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'RESUB',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          
          // Action Buttons
          Row(
            children: [
              TextButton(
                onPressed: () {
                  Navigator.of(context).pushNamed('/login');
                },
                child: const Text(
                  'Đăng nhập',
                  style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pushNamed('/dashboard');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  elevation: 0,
                ),
                child: const Text(
                  'Bắt đầu ngay',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeroSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.bolt, color: AppColors.primary, size: 14),
                SizedBox(width: 6),
                Text(
                  'Ứng Dụng Dịch Lồng Tiếng Tự Động Bằng AI',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          
          // Main Headline with Gradient
          ShaderMask(
            shaderCallback: (bounds) => const LinearGradient(
              colors: [Color(0xFF34D399), Color(0xFF10B981)],
            ).createShader(bounds),
            child: const Text(
              'LỒNG TIẾNG VIDEO\nCHỈ TRONG VÀI GIÂY',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.5,
                height: 1.2,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 18),
          
          Container(
            constraints: const BoxConstraints(maxWidth: 600),
            child: const Text(
              'Giải pháp tối ưu dành cho nhà sáng tạo nội dung. Nhận diện giọng nói tiếng Trung, dịch thuật lồng tiếng sang tiếng Việt và căn khớp timeline hoàn toàn tự động bằng công nghệ trí tuệ nhân tạo tiên tiến nhất.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.white70,
                height: 1.6,
              ),
            ),
          ),
          const SizedBox(height: 36),
          
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).pushNamed('/dashboard');
                },
                icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                label: const Text('Trải nghiệm Dashboard'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  elevation: 8,
                  shadowColor: AppColors.primary.withValues(alpha: 0.3),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required String title,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF131520),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.primary, size: 24),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.white60,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeaturesSection() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 60),
      color: const Color(0xFF08090E),
      child: Column(
        children: [
          const Text(
            'TÍNH NĂNG NỔI BẬT',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Quy Trình Lồng Tiếng Tự Động Khép Kín',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 40),
          
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 20,
            mainAxisSpacing: 20,
            childAspectRatio: 1.2,
            children: [
              _buildFeatureCard(
                icon: Icons.graphic_eq,
                title: 'Nhận diện giọng nói AI',
                description: 'Tự động nghe, phân tích giọng nói tiếng Trung và chuyển đổi thành văn bản chính xác.',
              ),
              _buildFeatureCard(
                icon: Icons.translate_rounded,
                title: 'Dịch thuật thông minh',
                description: 'Dịch thuật tự động chuẩn xác theo ngữ cảnh hội thoại, tự nhiên như người dịch.',
              ),
              _buildFeatureCard(
                icon: Icons.sync_rounded,
                title: 'Căn khớp Timeline tự động',
                description: 'Tự động khớp phụ đề và giọng đọc tiếng Việt theo đúng khung thời gian của video gốc.',
              ),
              _buildFeatureCard(
                icon: Icons.cut_rounded,
                title: 'Cắt nhỏ video FFmpeg',
                description: 'Cắt và ghép nối video dài nhanh chóng bằng thuật toán FFmpeg không làm giảm chất lượng.',
              ),
              _buildFeatureCard(
                icon: Icons.multitrack_audio_rounded,
                title: 'Tách nhạc nền tự động',
                description: 'Tách âm thanh gốc thành nhạc nền (BGM) và tiếng nói để xử lý lồng tiếng hoàn hảo.',
              ),
              _buildFeatureCard(
                icon: Icons.speed_rounded,
                title: 'Xử lý tốc độ cao',
                description: 'Nhận diện và dịch lồng tiếng cho video dài 5 phút chỉ trong chưa đầy 30 giây.',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPricingCard({
    required String title,
    required String price,
    required String period,
    required List<String> features,
    required bool isPro,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: isPro ? const Color(0xFF131520) : const Color(0xFF0C0D14),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPro ? AppColors.primary.withValues(alpha: 0.4) : Colors.white12,
          width: isPro ? 2 : 1,
        ),
        boxShadow: isPro
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  blurRadius: 20,
                  spreadRadius: 2,
                )
              ]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isPro ? AppColors.primary : Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                price,
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                period,
                style: const TextStyle(
                  fontSize: 13,
                  color: Colors.white60,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Divider(color: Colors.white12),
          const SizedBox(height: 24),
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_outline, color: AppColors.primary, size: 16),
                    const SizedBox(width: 10),
                    Text(
                      f,
                      style: const TextStyle(fontSize: 13, color: Colors.white70),
                    ),
                  ],
                ),
              )),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: isPro ? AppColors.primary : Colors.white.withValues(alpha: 0.08),
              foregroundColor: isPro ? Colors.black : Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: Text(
              isPro ? 'Nâng cấp ngay' : 'Sử dụng miễn phí',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPricingSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
      child: Column(
        children: [
          const Text(
            'BẢNG GIÁ DỊCH VỤ',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Chọn Gói Phù Hợp Với Nhu Cầu Của Bạn',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 50),
          
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 340,
                child: _buildPricingCard(
                  title: 'Gói FREE',
                  price: '0đ',
                  period: '/tháng',
                  features: [
                    '10 lượt xuất video miễn phí',
                    'Dịch và lồng tiếng tự động',
                    'Độ phân giải SD',
                    'Hỗ trợ cộng đồng',
                  ],
                  isPro: false,
                  onTap: () {
                    Navigator.of(context).pushNamed('/dashboard');
                  },
                ),
              ),
              const SizedBox(width: 40),
              SizedBox(
                width: 340,
                child: _buildPricingCard(
                  title: 'Gói PRO',
                  price: '199.000đ',
                  period: '/tháng',
                  features: [
                    '100 lượt xuất video chất lượng cao',
                    'Ưu tiên hàng đợi kết xuất nhanh nhất',
                    'Độ phân giải HD/FullHD tối đa',
                    'Hỗ trợ kỹ thuật 24/7',
                  ],
                  isPro: true,
                  onTap: () {
                    Navigator.of(context).pushNamed('/dashboard');
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40),
      decoration: const BoxDecoration(
        color: Color(0xFF08090E),
        border: Border(
          top: BorderSide(color: Colors.white12, width: 0.5),
        ),
      ),
      child: const Center(
        child: Text(
          '© 2026 RESUB. Tất cả quyền được bảo lưu.',
          style: TextStyle(fontSize: 12, color: Colors.white30),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C0D14),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeader(context),
            _buildHeroSection(context),
            _buildFeaturesSection(),
            _buildPricingSection(context),
            _buildFooter(),
          ],
        ),
      ),
    );
  }
}
