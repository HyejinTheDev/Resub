class UserModel {
  final String id;
  final String username;
  final String? email;
  final String subscriptionTier;
  final int videoExportQuota;
  final int videoExportUsed;

  UserModel({
    required this.id,
    required this.username,
    this.email,
    this.subscriptionTier = 'free',
    this.videoExportQuota = 10,
    this.videoExportUsed = 0,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      email: json['email']?.toString(),
      subscriptionTier: json['subscriptionTier']?.toString() ?? 'free',
      videoExportQuota: int.tryParse(json['videoExportQuota']?.toString() ?? '') ?? 10,
      videoExportUsed: int.tryParse(json['videoExportUsed']?.toString() ?? '') ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'subscriptionTier': subscriptionTier,
      'videoExportQuota': videoExportQuota,
      'videoExportUsed': videoExportUsed,
    };
  }
}
