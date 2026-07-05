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

  factory Subtitle.fromJson(Map<String, dynamic> json) {
    return Subtitle(
      startTime: json['startTime']?.toString() ?? '',
      endTime: json['endTime']?.toString() ?? '',
      chineseText: json['chineseText']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      voice: json['voice']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'startTime': startTime,
      'endTime': endTime,
      'chineseText': chineseText,
      'text': text,
      'voice': voice,
    };
  }

  @override
  List<Object?> get props => [startTime, endTime, chineseText, text, voice];
}
