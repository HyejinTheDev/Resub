import 'dart:async';
import 'package:cross_file/cross_file.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/models/subtitle_model.dart';
import '../../../domain/entities/subtitle.dart';
import '../../../domain/repositories/video_repository.dart';
import 'import_event.dart';
import 'import_state.dart';

class ImportBloc extends Bloc<ImportEvent, ImportState> {
  final VideoRepository videoRepository;
  XFile? _selectedFile;
  Timer? _pollingTimer;

  ImportBloc({required this.videoRepository}) : super(ImportInitial()) {
    on<SelectVideoEvent>(_onSelectVideo);
    on<StartUploadAndTranscribeEvent>(_onStartUploadAndTranscribe);
    on<PollProgressEvent>(_onPollProgress);
    on<ResetImportEvent>(_onResetImport);
    on<LoadSegmentAndTranscribeEvent>(_onLoadSegmentAndTranscribe);
  }

  void _onSelectVideo(SelectVideoEvent event, Emitter<ImportState> emit) {
    _selectedFile = event.file;
    emit(ImportFileSelected(event.file));
  }

  Future<void> _onStartUploadAndTranscribe(
    StartUploadAndTranscribeEvent event,
    Emitter<ImportState> emit,
  ) async {
    final file = _selectedFile;
    if (file == null) {
      emit(const ImportFailure('Chưa chọn video nào. Vui lòng chọn tệp video.'));
      return;
    }

    emit(ImportUploading(file: file, progress: 0.0));

    try {
      // 1. Upload video
      final uploadResult = await videoRepository.uploadVideo(
        file,
        onSendProgress: (sent, total) {
          if (total > 0 && !isClosed) {
            emit(ImportUploading(file: file, progress: sent / total));
          }
        },
      );

      final String? videoPath = uploadResult['videoPath'];
      final String? audioPath = uploadResult['audioPath'];

      if (videoPath == null || audioPath == null) {
        emit(const ImportFailure('Không nhận được đường dẫn tệp từ máy chủ sau khi tải lên.'));
        return;
      }

      emit(ImportTranscribing(
        file: file,
        percent: 0,
        message: 'Đang khởi động dịch video (AI)...',
      ));

      // 2. Start transcription
      final taskId = await videoRepository.startTranscription(
        videoPath: videoPath,
        audioPath: audioPath,
        geminiKey: event.geminiKey,
        useSystemPool: event.useSystemPool,
      );

      // 3. Trigger polling
      _pollingTimer?.cancel();
      add(PollProgressEvent(taskId));
    } catch (e) {
      emit(ImportFailure('Lỗi tải lên/khởi động dịch: ${e.toString()}'));
    }
  }

  Future<void> _onPollProgress(
    PollProgressEvent event,
    Emitter<ImportState> emit,
  ) async {
    // Note: _selectedFile might be null if transcribing a split segment
    final file = _selectedFile;

    try {
      final progress = await videoRepository.getTranscriptionProgress(event.taskId);
      final String status = progress['status'] ?? 'pending';
      final int percent = progress['percent'] ?? 0;
      final String message = progress['message'] ?? 'Đang dịch...';

      if (status == 'done') {
        final List<dynamic> subsJson = progress['subtitles'] ?? [];
        final List<Subtitle> subtitles = subsJson
            .map((json) => SubtitleModel.fromJson(json as Map<String, dynamic>))
            .toList();

        final detectedPos = progress['detectedPosition'];
        final int detectedY = detectedPos != null ? (detectedPos['yPercentage'] ?? 85) : 85;
        final int detectedHeight = detectedPos != null ? (detectedPos['heightPercentage'] ?? 15) : 15;

        final Map<String, dynamic> videoData = {
          'videoPath': progress['videoPath'] ?? '',
          'audioPath': progress['audioPath'] ?? '',
          'videoUrl': progress['videoUrl'] ?? '',
        };

        emit(ImportSuccess(
          subtitles: subtitles,
          detectedY: detectedY,
          detectedHeight: detectedHeight,
          videoData: videoData,
        ));
      } else if (status == 'error') {
        emit(ImportFailure(progress['error'] ?? 'Lỗi dịch thuật từ máy chủ'));
      } else {
        // Keep polling
        emit(ImportTranscribing(file: file, percent: percent, message: message));
        
        _pollingTimer?.cancel();
        _pollingTimer = Timer(const Duration(seconds: 3), () {
          if (!isClosed) {
            add(PollProgressEvent(event.taskId));
          }
        });
      }
    } catch (e) {
      emit(ImportFailure('Lỗi kiểm tra tiến trình: ${e.toString()}'));
    }
  }

  Future<void> _onLoadSegmentAndTranscribe(
    LoadSegmentAndTranscribeEvent event,
    Emitter<ImportState> emit,
  ) async {
    _selectedFile = null; // No local file tracked
    emit(const ImportTranscribing(
      file: null,
      percent: 0,
      message: 'Đang chuẩn bị phân đoạn video...',
    ));

    try {
      // 1. Load split segment to extract audio
      final result = await videoRepository.loadSplitSegment(event.filePath);

      final String? videoPath = result['videoPath'];
      final String? audioPath = result['audioPath'];

      if (videoPath == null || audioPath == null) {
        emit(const ImportFailure('Không thể tải phân đoạn video từ máy chủ.'));
        return;
      }

      emit(const ImportTranscribing(
        file: null,
        percent: 0,
        message: 'Đang khởi động dịch video (AI)...',
      ));

      // 2. Start transcription
      final taskId = await videoRepository.startTranscription(
        videoPath: videoPath,
        audioPath: audioPath,
        geminiKey: event.geminiKey,
        useSystemPool: event.useSystemPool,
      );

      // 3. Trigger polling
      _pollingTimer?.cancel();
      add(PollProgressEvent(taskId));
    } catch (e) {
      emit(ImportFailure('Lỗi tải phân đoạn: ${e.toString()}'));
    }
  }

  void _onResetImport(ResetImportEvent event, Emitter<ImportState> emit) {
    _pollingTimer?.cancel();
    _selectedFile = null;
    emit(ImportInitial());
  }

  @override
  Future<void> close() {
    _pollingTimer?.cancel();
    return super.close();
  }
}
