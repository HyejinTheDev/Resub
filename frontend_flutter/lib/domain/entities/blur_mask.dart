import 'package:equatable/equatable.dart';

class BlurMask extends Equatable {
  final String startTime;
  final String endTime;
  final double yPercentage;
  final double heightPercentage;
  final double xPercentage;
  final double widthPercentage;
  final double blurRadius;
  final String color;
  final double opacity;
  final bool enabled;

  const BlurMask({
    required this.startTime,
    required this.endTime,
    required this.yPercentage,
    required this.heightPercentage,
    required this.xPercentage,
    required this.widthPercentage,
    required this.blurRadius,
    required this.color,
    required this.opacity,
    this.enabled = true,
  });

  BlurMask copyWith({
    String? startTime,
    String? endTime,
    double? yPercentage,
    double? heightPercentage,
    double? xPercentage,
    double? widthPercentage,
    double? blurRadius,
    String? color,
    double? opacity,
    bool? enabled,
  }) {
    return BlurMask(
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      yPercentage: yPercentage ?? this.yPercentage,
      heightPercentage: heightPercentage ?? this.heightPercentage,
      xPercentage: xPercentage ?? this.xPercentage,
      widthPercentage: widthPercentage ?? this.widthPercentage,
      blurRadius: blurRadius ?? this.blurRadius,
      color: color ?? this.color,
      opacity: opacity ?? this.opacity,
      enabled: enabled ?? this.enabled,
    );
  }

  @override
  List<Object?> get props => [
        startTime,
        endTime,
        yPercentage,
        heightPercentage,
        xPercentage,
        widthPercentage,
        blurRadius,
        color,
        opacity,
        enabled,
      ];
}
