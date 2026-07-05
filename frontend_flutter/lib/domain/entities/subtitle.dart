import 'package:equatable/equatable.dart';

class Subtitle extends Equatable {
  final String startTime;
  final String endTime;
  final String chineseText;
  final String text;
  final String? voice;

  const Subtitle({
    required this.startTime,
    required this.endTime,
    required this.chineseText,
    required this.text,
    this.voice,
  });

  Subtitle copyWith({
    String? startTime,
    String? endTime,
    String? chineseText,
    String? text,
    String? voice,
  }) {
    return Subtitle(
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      chineseText: chineseText ?? this.chineseText,
      text: text ?? this.text,
      voice: voice ?? this.voice,
    );
  }

  @override
  List<Object?> get props => [startTime, endTime, chineseText, text, voice];
}
