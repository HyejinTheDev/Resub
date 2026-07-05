import '../../domain/entities/subtitle.dart';

class SubtitleModel extends Subtitle {
  const SubtitleModel({
    required super.startTime,
    required super.endTime,
    required super.chineseText,
    required super.text,
    super.voice,
  });

  factory SubtitleModel.fromJson(Map<String, dynamic> json) {
    return SubtitleModel(
      startTime: json['startTime'] ?? '',
      endTime: json['endTime'] ?? '',
      chineseText: json['chineseText'] ?? '',
      text: json['text'] ?? '',
      voice: json['voice'],
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
}
