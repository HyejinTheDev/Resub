import '../../domain/entities/blur_mask.dart';

class BlurMaskModel extends BlurMask {
  const BlurMaskModel({
    required super.startTime,
    required super.endTime,
    required super.yPercentage,
    required super.heightPercentage,
    required super.xPercentage,
    required super.widthPercentage,
    required super.blurRadius,
    required super.color,
    required super.opacity,
    super.enabled,
  });

  factory BlurMaskModel.fromJson(Map<String, dynamic> json) {
    return BlurMaskModel(
      startTime: json['startTime'] ?? '00m00s000ms',
      endTime: json['endTime'] ?? '00m00s000ms',
      yPercentage: (json['yPercentage'] as num?)?.toDouble() ?? 80.0,
      heightPercentage: (json['heightPercentage'] as num?)?.toDouble() ?? 15.0,
      xPercentage: (json['xPercentage'] as num?)?.toDouble() ?? 50.0,
      widthPercentage: (json['widthPercentage'] as num?)?.toDouble() ?? 80.0,
      blurRadius: (json['blurRadius'] as num?)?.toDouble() ?? 15.0,
      color: json['color'] ?? '#000000',
      opacity: (json['opacity'] as num?)?.toDouble() ?? 0.15,
      enabled: json['enabled'] ?? true,
    );
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'startTime': startTime,
      'endTime': endTime,
      'yPercentage': yPercentage,
      'heightPercentage': heightPercentage,
      'xPercentage': xPercentage,
      'widthPercentage': widthPercentage,
      'blurRadius': blurRadius,
      'color': color,
      'opacity': opacity,
      'enabled': enabled,
    };
  }
}
