import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Check, ChevronsUpDown, X, ImagePlus, Info, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { ImageEditor } from "./image-editor";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface Product {
  id: string;
  name: string;
  description: string;
  detailedDescription?: string;
  images?: string[];
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
  onlineStoreVisible?: boolean;
  plantId?: number;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: Partial<Product>) => void;
  product?: Product;
}

// 이미지 리사이즈 유틸리티 함수 (최대 1MB로 압축)
async function resizeImage(file: File, maxSizeKB: number = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // 최대 크기 제한 (1200px)
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 품질을 조절하며 압축
        let quality = 0.9;
        const compress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Blob creation failed'));
                return;
              }

              // 파일 크기가 목표 이하이거나 품질이 너무 낮으면 반환
              if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
                resolve(blob);
              } else {
                quality -= 0.1;
                compress();
              }
            },
            'image/jpeg',
            quality
          );
        };

        compress();
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export default function ProductDialog({ open, onOpenChange, onSave, product }: ProductDialogProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [name, setName] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [plants, setPlants] = useState<any[]>([]);
  const [plantSearchOpen, setPlantSearchOpen] = useState(false);
  const [plantSearchValue, setPlantSearchValue] = useState("");
  const [description, setDescription] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingAdditional, setUploadingAdditional] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [onlineStoreVisible, setOnlineStoreVisible] = useState(false);

  // 식물 목록 불러오기
  useEffect(() => {
    if (open && !product) {
      fetch('/api/plants')
        .then(response => response.json())
        .then(data => {
          setPlants(data || []);
        })
        .catch(error => {
          console.error('식물 목록 로딩 오류:', error);
        });
    }
  }, [open, product]);

  // 기존 제품 데이터 로딩
  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setDetailedDescription(product.detailedDescription || "");
      setImages(product.images || []);
      setPrice(product.price?.toString() || "");
      setStock(product.stock?.toString() || "");
      setCategory(product.category || "");
      setImageUrl(product.imageUrl || "");
      setOnlineStoreVisible(product.onlineStoreVisible || false);
      setSelectedPlantId(product.plantId?.toString() || "");
    } else {
      setName("");
      setDescription("");
      setDetailedDescription("");
      setImages([]);
      setPrice("");
      setStock("");
      setCategory("");
      setImageUrl("");
      setOnlineStoreVisible(false);
      setSelectedPlantId("");
      setPlantSearchValue("");
    }
    setActiveTab("basic");
  }, [product, open]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!name.trim()) {
      alert("상품명을 입력하세요.");
      setActiveTab("basic");
      return;
    }

    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert("유효한 가격을 입력하세요.");
      setActiveTab("basic");
      return;
    }

    const productData: Partial<Product> = {
      name: name.trim(),
      description: description.trim(),
      detailedDescription: detailedDescription.trim(),
      images: images.filter(img => img.trim()),
      price: Number(price),
      stock: Number(stock) || 0,
      category: category || "기타",
      imageUrl,
      onlineStoreVisible,
      plantId: selectedPlantId ? Number(selectedPlantId) : undefined
    };

    onSave(productData);
  };

  // 추가 이미지 업로드 핸들러
  const handleAdditionalImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      setUploadingAdditional(true);
      const newImages: string[] = [];

      for (const file of files) {
        try {
          // 파일 크기 체크 및 리사이즈
          let fileToUpload: Blob = file;
          if (file.size > 1024 * 1024) { // 1MB 이상이면 리사이즈
            console.log(`파일 리사이즈 중: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            fileToUpload = await resizeImage(file, 1024);
            console.log(`리사이즈 완료: ${(fileToUpload.size / 1024).toFixed(0)}KB`);
          }

          const formData = new FormData();
          formData.append('images', fileToUpload, file.name);

          const res = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            throw new Error(`업로드 실패: ${res.status}`);
          }

          const data = await res.json();
          if (data.success && data.imageUrl) {
            newImages.push(data.imageUrl);
          }
        } catch (error) {
          console.error('이미지 업로드 실패:', error);
          alert(`이미지 업로드 실패: ${file.name}`);
        }
      }

      if (newImages.length > 0) {
        setImages(prev => [...prev, ...newImages]);
      }
      setUploadingAdditional(false);
    };

    input.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {product ? "제품 수정" : "새 제품 등록"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0 mx-6 grid grid-cols-3">
            <TabsTrigger value="basic" className="flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">기본 정보</span>
              <span className="sm:hidden">기본</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">이미지</span>
              <span className="sm:hidden">이미지</span>
            </TabsTrigger>
            <TabsTrigger value="description" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">상세 설명</span>
              <span className="sm:hidden">설명</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* 기본 정보 탭 */}
            <TabsContent value="basic" className="mt-0 space-y-4">
              {!product && (
                <div className="grid gap-2">
                  <Label htmlFor="plant">식물 선택 <span className="text-red-500">*</span></Label>
                  <Popover open={plantSearchOpen} onOpenChange={setPlantSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={plantSearchOpen}
                        className="w-full justify-between"
                      >
                        {plantSearchValue || "식물을 검색하여 선택하세요..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="식물명을 검색하세요..." />
                        <CommandList>
                          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                          <CommandGroup>
                            {plants.map((plant) => (
                              <CommandItem
                                key={plant.id}
                                value={plant.name}
                                onSelect={(currentValue) => {
                                  setPlantSearchValue(currentValue);
                                  setSelectedPlantId(plant.id.toString());
                                  setName(plant.name);
                                  setPlantSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={selectedPlantId === plant.id.toString() ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"}
                                />
                                {plant.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="name">상품명 <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  placeholder="상품명을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">카테고리</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="관엽식물">관엽식물</SelectItem>
                    <SelectItem value="다육식물">다육식물</SelectItem>
                    <SelectItem value="허브">허브</SelectItem>
                    <SelectItem value="화초">화초</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">가격 (원) <span className="text-red-500">*</span></Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stock">재고 수량</Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="onlineStore" className="font-medium">지역 상점 검색 노출</Label>
                  <p className="text-xs text-gray-500 mt-0.5">활성화하면 주변 검색 결과에 노출됩니다</p>
                </div>
                <Switch
                  id="onlineStore"
                  checked={onlineStoreVisible}
                  onCheckedChange={setOnlineStoreVisible}
                />
              </div>
            </TabsContent>

            {/* 이미지 탭 */}
            <TabsContent value="images" className="mt-0 space-y-6">
              {/* 대표 이미지 */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">대표 이미지</Label>
                  <p className="text-xs text-gray-500 mt-0.5">제품 목록에 표시될 메인 이미지입니다</p>
                </div>

                <ImageEditor
                  imageUrl={previewUrl || imageUrl}
                  onImageSave={async (editedImageDataUrl) => {
                    console.log("[ProductDialog] 이미지 편집 완료, 업로드 시작");
                    setUploading(true);
                    try {
                      const response = await fetch(editedImageDataUrl);
                      const blob = await response.blob();

                      // 크기 체크 및 리사이즈
                      let finalBlob = blob;
                      if (blob.size > 1024 * 1024) {
                        const file = new File([blob], "edited-image.jpg", { type: 'image/jpeg' });
                        finalBlob = await resizeImage(file, 1024);
                      }

                      const formData = new FormData();
                      formData.append("images", finalBlob, "edited-image.jpg");

                      console.log("[ProductDialog] 서버에 이미지 업로드 중...");
                      const uploadResponse = await fetch("/api/upload-image", {
                        method: "POST",
                        body: formData
                      });

                      if (!uploadResponse.ok) {
                        throw new Error("이미지 업로드에 실패했습니다");
                      }

                      const data = await uploadResponse.json();
                      console.log("[ProductDialog] 업로드 응답:", data);

                      if (data.success && data.imageUrl) {
                        setImageUrl(data.imageUrl);
                        setPreviewUrl("");
                        alert("이미지가 업로드되었습니다.");
                      } else {
                        throw new Error("이미지 URL이 응답에 포함되지 않았습니다");
                      }
                    } catch (error) {
                      console.error("[ProductDialog] 이미지 처리 오류:", error);
                      alert("이미지 처리 중 오류가 발생했습니다.");
                    } finally {
                      setUploading(false);
                    }
                  }}
                  aspectRatio={1}
                />

                {uploading && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">이미지 업로드 중...</span>
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t pt-6">
                {/* 추가 이미지 */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-semibold">추가 이미지</Label>
                    <p className="text-xs text-gray-500 mt-0.5">제품 상세 페이지에 표시될 추가 이미지입니다 (최대 5장)</p>
                  </div>

                  {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square">
                          <img
                            src={img}
                            alt={`추가 이미지 ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => setImages(images.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {images.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAdditionalImageUpload}
                      disabled={uploadingAdditional}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      {uploadingAdditional ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm text-gray-600">업로드 중...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <ImagePlus className="w-8 h-8 text-gray-400" />
                          <span className="text-sm text-gray-600">클릭하여 이미지 추가</span>
                          <span className="text-xs text-gray-400">PNG, JPG (최대 5MB)</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* 상세 설명 탭 */}
            <TabsContent value="description" className="mt-0 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="description">간단한 설명</Label>
                <Textarea
                  id="description"
                  placeholder="상품의 한 줄 설명을 입력하세요"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label>상세 설명</Label>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <ReactQuill
                    value={detailedDescription}
                    onChange={setDetailedDescription}
                    theme="snow"
                    placeholder="상세한 상품 설명을 입력하세요..."
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'color': [] }],
                        ['link'],
                        ['clean']
                      ]
                    }}
                    formats={['header', 'bold', 'italic', 'underline', 'list', 'color', 'link']}
                    style={{ minHeight: '250px' }}
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-gray-50">
          <div className="flex w-full justify-between items-center">
            <div className="text-xs text-gray-500">
              {activeTab === "basic" && "1/3 단계"}
              {activeTab === "images" && "2/3 단계"}
              {activeTab === "description" && "3/3 단계"}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button onClick={handleSubmit} disabled={uploading || uploadingAdditional}>
                {uploading || uploadingAdditional ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    처리 중...
                  </>
                ) : (
                  product ? "수정 완료" : "등록하기"
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
