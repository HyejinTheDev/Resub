class ProjectModel {
  final String id;
  final String name;
  final int createdAt;
  final int updatedAt;
  final List<dynamic> subtitles;
  final List<dynamic> blurMasks;
  final Map<String, dynamic> subtitleStyle;
  final Map<String, dynamic> cropStyle;
  final Map<String, dynamic> videoTransform;
  final Map<String, dynamic> videoData;
  final Map<String, dynamic> storyboard;

  ProjectModel({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
    required this.subtitles,
    required this.blurMasks,
    required this.subtitleStyle,
    required this.cropStyle,
    required this.videoTransform,
    required this.videoData,
    required this.storyboard,
  });

  factory ProjectModel.fromJson(Map<String, dynamic> json) {
    return ProjectModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      createdAt: (json['createdAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
      updatedAt: (json['updatedAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
      subtitles: json['subtitles'] as List<dynamic>? ?? [],
      blurMasks: json['blurMasks'] as List<dynamic>? ?? [],
      subtitleStyle: json['subtitleStyle'] as Map<String, dynamic>? ?? {},
      cropStyle: json['cropStyle'] as Map<String, dynamic>? ?? {},
      videoTransform: json['videoTransform'] as Map<String, dynamic>? ?? {},
      videoData: json['videoData'] as Map<String, dynamic>? ?? {},
      storyboard: json['storyboard'] as Map<String, dynamic>? ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'subtitles': subtitles,
      'blurMasks': blurMasks,
      'subtitleStyle': subtitleStyle,
      'cropStyle': cropStyle,
      'videoTransform': videoTransform,
      'videoData': videoData,
      'storyboard': storyboard,
    };
  }
}
